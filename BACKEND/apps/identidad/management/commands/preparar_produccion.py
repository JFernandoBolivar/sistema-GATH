"""Prepara una base para producción/QA en un solo paso idempotente.

Se ejecuta automáticamente desde el servicio `bootstrap` de Compose. Las
migraciones de esquema las sigue aplicando `docker-entrypoint.sh`; este comando
se encarga de los datos:

1. Garantiza la cuenta ADMINISTRADOR de la cédula 30799436.
2. Si la base no tiene la marca de bootstrap: `seed_permisos`, mapeo de roles
   heredados y sincronización de cuentas de trabajadores.
3. Guarda la marca para no repetir los pasos pesados en cada arranque.

Uso:
    python manage.py preparar_produccion
    python manage.py preparar_produccion --force
"""
import json
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.password_inicial_model import (
    PasswordInicialModel,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.bootstrap import BootstrapStateModel

CEDULA_SUPERADMIN = '30799436'
CLAVE_BOOTSTRAP = 'produccion'
DIAS_PASSWORD_INICIAL = 7


class Command(BaseCommand):
    help = (
        'Prepara la base una sola vez: superadministrador, permisos, mapeo de '
        'roles y sincronización de cuentas. Idempotente.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Repite los pasos de datos aunque la marca de bootstrap exista.',
        )
        parser.add_argument(
            '--automatico',
            action='store_true',
            help='Modo no interactivo usado por el servicio bootstrap.',
        )

    def handle(self, *args, **opciones):
        self._asegurar_superadmin()

        if BootstrapStateModel.objects.filter(clave=CLAVE_BOOTSTRAP).exists() and not opciones['force']:
            self.stdout.write(
                self.style.SUCCESS(
                    'Bootstrap ya aplicado en esta base. Solo se verificó el superadministrador.'
                )
            )
            return

        self.stdout.write('Ejecutando seed de permisos...')
        call_command('seed_permisos')

        self.stdout.write('Normalizando roles heredados...')
        call_command('migrar_roles_legados', aplicar=True)

        self.stdout.write('Sincronizando cuentas de trabajadores...')
        call_command('sincronizar_cuentas_trabajadores', aplicar=True)

        detalle = json.dumps(
            {
                'superadmin': CEDULA_SUPERADMIN,
                'aplicado_en': timezone.now().isoformat(),
            },
            ensure_ascii=False,
        )
        BootstrapStateModel.objects.update_or_create(
            clave=CLAVE_BOOTSTRAP,
            defaults={'detalle': detalle},
        )
        self.stdout.write(self.style.SUCCESS('Bootstrap de producción completado.'))

    def _asegurar_superadmin(self) -> None:
        empleado = EmployeeModel.objects.filter(
            cedulaidentidad=CEDULA_SUPERADMIN
        ).first()
        if empleado is None:
            raise CommandError(
                f'No existe el empleado {CEDULA_SUPERADMIN}: no se puede garantizar '
                'el superadministrador. El despliegue se detiene.'
            )

        rol = RolModel.objects.filter(pk=1).first()
        if rol is None:
            raise CommandError('No existe el rol 1 ADMINISTRADOR en USER_rol.')

        ahora = timezone.now()
        with transaction.atomic():
            cuenta = CuentaModel.objects.filter(cedula_id=CEDULA_SUPERADMIN).first()
            if cuenta is None:
                cuenta = CuentaModel.objects.create(
                    cedula_id=CEDULA_SUPERADMIN,
                    rol_id=1,
                    is_active=True,
                    password=make_password(CEDULA_SUPERADMIN),
                )
                PasswordInicialModel.objects.update_or_create(
                    cuenta_id=cuenta.pk,
                    defaults={
                        'emitida_en': ahora,
                        'vence_en': ahora + timedelta(days=DIAS_PASSWORD_INICIAL),
                    },
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Cuenta ADMINISTRADOR creada para {CEDULA_SUPERADMIN}.'
                    )
                )
                return

            cambios = []
            if cuenta.rol_id != 1:
                cuenta.rol_id = 1
                cambios.append('rol')
            if not cuenta.is_active:
                cuenta.is_active = True
                cambios.append('is_active')
            if cambios:
                cuenta.save(update_fields=cambios)
                RepoPermisosVersionORM().incrementar_cuenta(cuenta.pk)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Cuenta {CEDULA_SUPERADMIN} actualizada: {", ".join(cambios)}.'
                    )
                )
            else:
                self.stdout.write(
                    f'Cuenta {CEDULA_SUPERADMIN} ya es ADMINISTRADOR y está activa.'
                )
