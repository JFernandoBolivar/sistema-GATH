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

# Roles heredados que ya tienen equivalente nuevo. Se resuelven por NOMBRE:
# en bases heredadas el ID puede no coincidir (p. ej. RECEPCIONISTA en 6).
ROLES_EQUIVALENTES = (
    'ADMINISTRADOR',
    'ANALISTA',
    'AUTOGESTION',
    'PRESUPUESTO',
    'BIENESTAR SOCIAL',
    'RECEPCIONISTA',
)
ROLES_NUEVOS = ('ANALISTA_BIENESTAR', 'ADMIN_BIENESTAR', 'AUDITOR', 'JEFE_RRHH')


def _normalizar_rol(nombre: str) -> str:
    return ' '.join(
        str(nombre or '').strip().upper().replace('BIENSTAR', 'BIENESTAR').split()
    )


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

        roles_existentes = {
            _normalizar_rol(nombre): rol_id
            for rol_id, nombre in RolModel.objects.values_list('id', 'nombre_rol')
        }
        ids_equivalentes = {
            roles_existentes[nombre]
            for nombre in ROLES_EQUIVALENTES
            if nombre in roles_existentes
        }
        ids_nuevos = {
            roles_existentes[nombre]
            for nombre in ROLES_NUEVOS
            if nombre in roles_existentes
        }
        faltantes = [
            nombre for nombre in ROLES_EQUIVALENTES if nombre not in roles_existentes
        ]
        if faltantes:
            # No se aborta el bootstrap: en una base heredada el rol puede
            # tener otro nombre o no existir todavía. Se reporta y se sigue.
            self.stderr.write(
                self.style.WARNING(
                    'Roles esperados ausentes en USER_rol (se omiten): '
                    + ', '.join(faltantes)
                )
            )

        ids_validos = set(roles_existentes.values())
        for cedula, rol_id in list(excepciones.items()):
            if rol_id not in ids_validos:
                self.stderr.write(
                    self.style.WARNING(
                        f'Excepción {cedula}:{rol_id} ignorada: el rol no existe en USER_rol.'
                    )
                )
                excepciones.pop(cedula)

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

            if actual in ids_nuevos:
                resumen['omitidas'] += 1
                continue

            destino = excepciones.get(str(cuenta.cedula_id))
            if destino is None:
                destino = actual if actual in ids_equivalentes else None
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
