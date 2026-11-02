"""Sincroniza las cuentas AUTOGESTION de los trabajadores con su condición real.

- Activo o pasivo con correo válido: crea la cuenta si falta (rol AUTOGESTION,
  contraseña = cédula y cambio obligatorio al primer ingreso).
- Sin correo: no crea una cuenta inutilizable (el login es por correo); lo deja
  en el reporte `sin_correo` para que RRHH complete el dato.
- Sin asignación activa ni pasiva: desactiva solo cuentas AUTOGESTION y solo si
  la baja fue por egreso. Nunca toca cuentas administrativas.
- Reingreso: reactiva la cuenta si la baja fue por egreso.

Uso:
    python manage.py sincronizar_cuentas_trabajadores --dry-run
    python manage.py sincronizar_cuentas_trabajadores --aplicar
    python manage.py sincronizar_cuentas_trabajadores --aplicar --reporte /tmp/cuentas.json
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.core.validators import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.identidad.application.dtos.cuenta_dto import RegistrarCuentaDTO
from apps.identidad.application.use_cases.reactivar_cuenta_por_reingreso import (
    reactivar_cuenta_por_reingreso,
)
from apps.identidad.application.use_cases.desactivar_cuenta_por_egreso import (
    desactivar_cuenta_por_egreso,
)
from apps.identidad.application.use_cases.registrar_usuario import registrar_usuario
from apps.identidad.domain.services.politica_password_inicial import (
    DIAS_VIGENCIA_PASSWORD_INICIAL,
    ROL_AUTOGESTION_ID,
    vencimiento_desde,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_desactivacion_egreso_orm import (
    RepoDesactivacionEgresoORM,
)
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS
from core.domain.exceptions import ConflictError
from core.infrastructure.providers import obtener_lector_configuracion


class Command(BaseCommand):
    help = (
        'Crea, reactiva o desactiva cuentas AUTOGESTION según la condición '
        'ACTIVO/PASIVO del trabajador. No crea cuentas sin correo.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar',
            action='store_true',
            help='Aplica los cambios. Sin esta bandera solo reporta (dry-run).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Fuerza el modo simulación aunque se indique --aplicar.',
        )
        parser.add_argument(
            '--reporte',
            metavar='RUTA',
            help='Escribe el detalle en un JSON (opcional).',
        )

    def handle(self, *args, **opciones):
        aplicar = bool(opciones['aplicar']) and not opciones['dry_run']
        ahora = timezone.now()
        dias = self._dias_vigencia()
        resumen = {
            'creadas': 0,
            'reactivadas': 0,
            'desactivadas': 0,
            'omitidas': 0,
            'revision_manual': 0,
            'correos_invalidos': 0,
            'sin_correo': 0,
        }
        detalle = {
            'creadas': [],
            'reactivadas': [],
            'desactivadas': [],
            'revision_manual': [],
            'correos_invalidos': [],
            'sin_correo': [],
        }

        activos, pasivos = self._condiciones()
        cuentas = {
            cuenta.cedula_id: cuenta
            for cuenta in CuentaModel.objects.only(
                'id', 'cedula_id', 'rol_id', 'is_active'
            )
        }

        con_correo = EmployeeModel.objects.exclude(correo__isnull=True).exclude(correo='')
        for cedula, nombres, apellidos, correo in con_correo.values_list(
            'cedulaidentidad', 'nombres', 'apellidos', 'correo'
        ).iterator():
            condicion = self._condicion(cedula, activos, pasivos)
            try:
                validate_email(correo)
            except DjangoValidationError:
                resumen['correos_invalidos'] += 1
                detalle['correos_invalidos'].append({'cedula': cedula, 'correo': correo})
                continue

            cuenta = cuentas.get(cedula)
            if condicion is None:
                self._desactivar_si_corresponde(
                    cuenta, cedula, aplicar, resumen, detalle
                )
                continue

            if cuenta is None:
                self._crear_cuenta(cedula, aplicar, ahora, dias, resumen, detalle)
                continue

            if cuenta.rol_id != ROL_AUTOGESTION_ID:
                resumen['omitidas'] += 1
                continue

            if cuenta.is_active:
                resumen['omitidas'] += 1
                continue

            self._reactivar_si_corresponde(cuenta, aplicar, resumen, detalle)

        self._reportar_sin_correo(activos, pasivos, resumen, detalle)

        if opciones.get('reporte'):
            self._escribir_reporte(Path(opciones['reporte']), resumen, detalle)

        estado = 'aplicado' if aplicar else 'simulado (dry-run)'
        self.stdout.write(
            self.style.SUCCESS(
                f'Sincronización de cuentas {estado}: '
                f'creadas={resumen["creadas"]}, reactivadas={resumen["reactivadas"]}, '
                f'desactivadas={resumen["desactivadas"]}, omitidas={resumen["omitidas"]}, '
                f'revisión manual={resumen["revision_manual"]}, '
                f'correos inválidos={resumen["correos_invalidos"]}, '
                f'sin correo={resumen["sin_correo"]}.'
            )
        )

    def _condiciones(self) -> tuple[set[str], set[str]]:
        pasivos = set(
            AsigTrabajoModel.objects.filter(
                Tipo_personal__tipo_personal__iexact='PASIVO', employee__isnull=False
            ).values_list('employee_id', flat=True)
        ) | set(EmployeeEgresadoModel.objects.values_list('employee_id', flat=True))
        activos = set(
            AsigTrabajoModel.objects.filter(
                estatusid__estatus__iexact='ACTIVO', employee__isnull=False
            )
            .exclude(Tipo_personal__tipo_personal__iexact='PASIVO')
            .values_list('employee_id', flat=True)
        ) - pasivos
        return activos, pasivos

    @staticmethod
    def _condicion(cedula: str, activos: set[str], pasivos: set[str]) -> str | None:
        if cedula in pasivos:
            return 'PASIVO'
        if cedula in activos:
            return 'ACTIVO'
        return None

    def _crear_cuenta(self, cedula, aplicar, ahora, dias, resumen, detalle) -> None:
        if not aplicar:
            resumen['creadas'] += 1
            detalle['creadas'].append({'cedula': cedula})
            return
        try:
            with transaction.atomic():
                cuenta = registrar_usuario(
                    RepoCuentasORM(),
                    RegistrarCuentaDTO(
                        cedula=cedula, password=cedula, rol_id=ROL_AUTOGESTION_ID
                    ),
                )
                RepoPasswordInicialORM().emitir(
                    cuenta.id, vencimiento_desde(ahora, dias)
                )
        except ConflictError:
            resumen['omitidas'] += 1
            return
        resumen['creadas'] += 1
        detalle['creadas'].append({'cedula': cedula})

    def _reactivar_si_corresponde(self, cuenta, aplicar, resumen, detalle) -> None:
        if not RepoDesactivacionEgresoORM().existe(cuenta.id):
            resumen['revision_manual'] += 1
            detalle['revision_manual'].append(
                {'cedula': cuenta.cedula_id, 'motivo': 'cuenta inactiva sin marca de egreso'}
            )
            return
        if not aplicar:
            resumen['reactivadas'] += 1
            detalle['reactivadas'].append({'cedula': cuenta.cedula_id})
            return
        with transaction.atomic():
            reactivar_cuenta_por_reingreso(
                RepoCuentasORM(),
                RepoCondicionTrabajadorORM(),
                RepoDesactivacionEgresoORM(),
                cuenta.cedula_id,
            )
        resumen['reactivadas'] += 1
        detalle['reactivadas'].append({'cedula': cuenta.cedula_id})

    def _desactivar_si_corresponde(self, cuenta, cedula, aplicar, resumen, detalle) -> None:
        if (
            cuenta is None
            or cuenta.rol_id != ROL_AUTOGESTION_ID
            or not cuenta.is_active
        ):
            resumen['omitidas'] += 1
            return
        if not aplicar:
            resumen['desactivadas'] += 1
            detalle['desactivadas'].append({'cedula': cedula})
            return
        with transaction.atomic():
            desactivar_cuenta_por_egreso(
                RepoCuentasORM(),
                RepoCondicionTrabajadorORM(),
                RepoDesactivacionEgresoORM(),
                cedula,
            )
        resumen['desactivadas'] += 1
        detalle['desactivadas'].append({'cedula': cedula})

    def _reportar_sin_correo(self, activos, pasivos, resumen, detalle) -> None:
        sin_correo = EmployeeModel.objects.filter(correo__isnull=True) | EmployeeModel.objects.filter(correo='')
        for cedula, nombres, apellidos in sin_correo.values_list(
            'cedulaidentidad', 'nombres', 'apellidos'
        ).iterator():
            condicion = self._condicion(cedula, activos, pasivos)
            if condicion is None:
                continue
            resumen['sin_correo'] += 1
            if len(detalle['sin_correo']) < 100:
                detalle['sin_correo'].append(
                    {
                        'cedula': cedula,
                        'nombre': f'{nombres} {apellidos}'.strip(),
                        'condicion': condicion,
                    }
                )

    @staticmethod
    def _dias_vigencia() -> int:
        lector = obtener_lector_configuracion()
        return (
            lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)
            if lector is not None
            else DIAS_VIGENCIA_PASSWORD_INICIAL
        )

    def _escribir_reporte(self, ruta: Path, resumen: dict, detalle: dict) -> None:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(
            json.dumps({'resumen': resumen, 'detalle': detalle}, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        self.stdout.write(f'Reporte escrito en {ruta}')
