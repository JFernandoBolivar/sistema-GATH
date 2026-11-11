"""
Comando S2-02: vence la contraseña inicial de las cuentas antiguas.

Las cuentas creadas antes del control de vencimiento tienen la cédula como
contraseña y ninguna fila en `identidad_cuenta_password_inicial`, así que nunca
caducaban. Este comando emite esa fila **solo** para las que siguen con la
cédula, con el plazo del parámetro `plazos.password_inicial_dias`.

Uso:
    python manage.py vencer_claves_iniciales_antiguas            # aplica
    python manage.py vencer_claves_iniciales_antiguas --dry-run  # solo cuenta
    python manage.py vencer_claves_iniciales_antiguas --encolar  # encola y sale (arranque)

Es idempotente: no toca cuentas con fila ni cuentas que cambiaron la clave. No
registra cédulas, solo cuántas revisó y cuántas ajustó.
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.identidad.application.use_cases.vencer_claves_iniciales import (
    vencer_claves_iniciales_antiguas,
)
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.configuracion.infrastructure.lector_configuracion import LectorConfiguracionORM

logger = logging.getLogger('gath.identidad')


class Command(BaseCommand):
    help = 'Vence la contraseña inicial (la cédula) de las cuentas antiguas que aún la usan.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Cuenta cuántas cuentas se ajustarían, sin escribir nada.',
        )
        parser.add_argument(
            '--encolar', action='store_true',
            help='Encola la tarea en Celery y sale de inmediato (para el arranque).',
        )

    def handle(self, *args, **options):
        if options['encolar']:
            return self._encolar()
        return self._aplicar(dry_run=options['dry_run'])

    def _encolar(self) -> None:
        from apps.identidad.infrastructure.tasks.vencer_claves_tasks import encolar_si_falta

        try:
            encolada = encolar_si_falta()
        except Exception as exc:  # broker caído: no debe impedir el arranque
            self.stdout.write(f'No se pudo encolar la tarea: {exc}')
            logger.warning('claves_iniciales_antiguas: no se pudo encolar (%s)', exc)
            return
        if encolada:
            self.stdout.write('Tarea de vencimiento de claves iniciales encolada.')
        else:
            self.stdout.write('Ya ejecutada o en curso: no se encola de nuevo.')

    def _aplicar(self, *, dry_run: bool) -> None:
        resultado = vencer_claves_iniciales_antiguas(
            RepoPasswordInicialORM(),
            LectorConfiguracionORM(),
            ahora=timezone.now(),
            dry_run=dry_run,
        )
        etiqueta = 'dry-run' if dry_run else 'aplicado'
        self.stdout.write(
            f'[{etiqueta}] revisadas={resultado.revisadas} ajustadas={resultado.ajustadas} '
            f'dias={resultado.dias}'
        )
        logger.info(
            'claves_iniciales_antiguas %s: revisadas=%s ajustadas=%s dias=%s',
            etiqueta, resultado.revisadas, resultado.ajustadas, resultado.dias,
        )
