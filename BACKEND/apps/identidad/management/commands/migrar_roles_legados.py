"""Normaliza el rol de las cuentas heredadas (rol + departamento).

La autorización nueva usa solo `rol_id`; el departamento queda como dato
histórico. Para la base actual los roles 1, 2, 3, 4, 5 y 9 ya tienen un
equivalente directo, así que el comando no remapea en masa: valida, reporta y
aplica solo las excepciones explícitas.

Uso:
    python manage.py migrar_roles_legados --dry-run
    python manage.py migrar_roles_legados --aplicar
    python manage.py migrar_roles_legados --aplicar --excepcion 12345678:14
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)

# Roles heredados que ya tienen equivalente nuevo por su mismo id.
ROLES_EQUIVALENTES = {
    1: 1,  # ADMINISTRADOR
    2: 2,  # ANALISTA
    3: 3,  # AUTOGESTION
    4: 4,  # PRESUPUESTO
    5: 5,  # BIENESTAR SOCIAL (se deja; reasignación manual si aplica)
    9: 9,  # RECEPCIONISTA
}
ROLES_NUEVOS = {13, 14, 17, 18}


class Command(BaseCommand):
    help = (
        'Valida el mapeo de roles heredados y aplica solo las excepciones '
        'explícitas. No remapea masivamente AUTOGESTION ni toca roles nuevos.'
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
            '--excepcion',
            action='append',
            default=[],
            metavar='CEDULA:ROL_ID',
            help='Excepción puntual, por ejemplo 12345678:14. Se puede repetir.',
        )

    def handle(self, *args, **opciones):
        aplicar = bool(opciones['aplicar']) and not opciones['dry_run']
        excepciones = self._leer_excepciones(opciones['excepcion'])

        roles_existentes = set(RolModel.objects.values_list('id', flat=True))
        for rol_id in set(ROLES_EQUIVALENTES.values()) | set(excepciones.values()):
            if rol_id not in roles_existentes:
                raise CommandError(f'El rol destino {rol_id} no existe en USER_rol.')

        resumen = {'sin_cambio': 0, 'cambiadas': 0, 'omitidas': 0, 'invalidas': 0}
        cambios = []
        cuentas = CuentaModel.objects.only('id', 'cedula_id', 'rol_id', 'is_active')
        for cuenta in cuentas.iterator():
            actual = cuenta.rol_id
            if actual is None:
                resumen['invalidas'] += 1
                self.stderr.write(
                    f'Cuenta {cuenta.id} ({cuenta.cedula_id}) sin rol: requiere revisión manual.'
                )
                continue

            if actual in ROLES_NUEVOS:
                resumen['omitidas'] += 1
                continue

            destino = excepciones.get(str(cuenta.cedula_id), ROLES_EQUIVALENTES.get(actual))
            if destino is None:
                resumen['invalidas'] += 1
                self.stderr.write(
                    f'Cuenta {cuenta.id} ({cuenta.cedula_id}) con rol desconocido {actual}: '
                    'requiere revisión manual.'
                )
                continue

            if destino == actual:
                resumen['sin_cambio'] += 1
                continue

            cambios.append((cuenta, actual, destino))

        if not aplicar:
            for cuenta, actual, destino in cambios:
                self.stdout.write(
                    f'[dry-run] {cuenta.cedula_id}: rol {actual} -> {destino}'
                )
            self.stdout.write(
                self.style.WARNING(
                    f'Sin cambios aplicados. Cambiarían {len(cambios)} cuenta(s). '
                    f'Resumen: {resumen}'
                )
            )
            return

        with transaction.atomic():
            versiones = RepoPermisosVersionORM()
            for cuenta, actual, destino in cambios:
                CuentaModel.objects.filter(pk=cuenta.pk).update(rol_id=destino)
                versiones.incrementar_cuenta(cuenta.pk)
                resumen['cambiadas'] += 1
                self.stdout.write(f'{cuenta.cedula_id}: rol {actual} -> {destino}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Mapeo de roles aplicado. Cambiadas: {resumen["cambiadas"]}; '
                f'sin cambio: {resumen["sin_cambio"]}; omitidas: {resumen["omitidas"]}; '
                f'inválidas: {resumen["invalidas"]}.'
            )
        )

    @staticmethod
    def _leer_excepciones(valores: list[str]) -> dict[str, int]:
        excepciones: dict[str, int] = {}
        for valor in valores:
            cedula, separador, rol = valor.partition(':')
            if not separador or not cedula.strip() or not rol.strip().isdigit():
                raise CommandError(
                    f'Excepción inválida «{valor}». Use el formato CEDULA:ROL_ID.'
                )
            excepciones[cedula.strip()] = int(rol.strip())
        return excepciones
