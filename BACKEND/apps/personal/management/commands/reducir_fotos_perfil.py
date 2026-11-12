"""Opcional: reduce las fotos de perfil ya guardadas (lado largo <= 800 px, JPEG q88).

Uso:
    python manage.py reducir_fotos_perfil --dry-run   # solo informa
    python manage.py reducir_fotos_perfil             # sube la versión reducida y repunta `profile`

Las fotos nuevas ya se reducen al subirlas; esto solo afecta las anteriores.
La clave nueva reemplaza a la antigua en `profile`; la antigua no se borra.
"""
from django.core.management.base import BaseCommand

from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.storage.imagenes import LADO_MAXIMO_PERFIL_PX, reducir_foto_perfil
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import clave_segura


class Command(BaseCommand):
    help = 'Reduce las fotos de perfil ya guardadas (opcional).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Solo informa, no escribe.')

    def handle(self, *args, **options):
        dry = options['dry_run']
        almacen = SeaweedFSStorage()
        reducidas = omitidas = errores = 0
        for emp in EmployeeModel.objects.exclude(profile__isnull=True).exclude(profile=''):
            try:
                original = almacen.descargar(emp.profile)
                nuevo, tipo, ext = reducir_foto_perfil(original)
                if len(nuevo) >= len(original):
                    omitidas += 1
                    continue
                self.stdout.write(f"{emp.cedulaidentidad}: {len(original)} -> {len(nuevo)} bytes")
                if not dry:
                    clave = clave_segura('perfiles', ext)
                    almacen.subir(clave, nuevo, tipo.mime)
                    emp.profile = clave
                    emp.save(update_fields=['profile'])
                reducidas += 1
            except Exception as exc:  # una foto rota no detiene el resto
                errores += 1
                self.stderr.write(f"{emp.cedulaidentidad}: {exc}")
        self.stdout.write(
            f"{'[dry-run] ' if dry else ''}reducidas={reducidas} omitidas={omitidas} errores={errores} "
            f"(limite {LADO_MAXIMO_PERFIL_PX}px)"
        )
