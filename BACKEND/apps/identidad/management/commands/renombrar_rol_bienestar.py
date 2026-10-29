"""
B14 — Corrige la etiqueta del rol 5: «BIENSTAR SOCIAL» -> «BIENESTAR SOCIAL».

Es un UPDATE de DATO sobre `USER_rol` (sin ALTER), aprobado por el usuario el 2026-10-29. El
rol se identifica por su id (5), así que sus permisos y cuentas no se tocan. Versionado e
IDEMPOTENTE: si ya está corregido, no hace nada.

    python manage.py renombrar_rol_bienestar [--respaldo-dir RUTA] [--dry-run]

Antes de modificar, vuelca `USER_rol` completo y la matriz de permisos del rol a un archivo JSON.
Después sube `permisos_version` de las cuentas del rol (las sesiones vigentes se refrescan).
"""
import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.identidad.infrastructure.legado.cuenta_models import CuentaEspejo
from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import RolPermisoModel
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import RepoPermisosVersionORM

ROL_ID = 5
NOMBRE_ANTERIOR = 'BIENSTAR SOCIAL'
NOMBRE_CORRECTO = 'BIENESTAR SOCIAL'


class Command(BaseCommand):
    help = "Renombra el rol 5 de «BIENSTAR SOCIAL» a «BIENESTAR SOCIAL» (UPDATE de dato, con respaldo)."

    def add_arguments(self, parser):
        parser.add_argument('--respaldo-dir', default='respaldos', help='Carpeta donde se guarda el respaldo previo.')
        parser.add_argument('--dry-run', action='store_true', help='Solo informa; no respalda ni modifica.')

    def handle(self, *args, **opciones):
        rol = RolModel.objects.filter(pk=ROL_ID).first()
        if rol is None:
            raise CommandError(f'No existe el rol con id {ROL_ID}.')
        if rol.nombre_rol == NOMBRE_CORRECTO:
            self.stdout.write(self.style.SUCCESS(f'Sin cambios: el rol {ROL_ID} ya se llama «{NOMBRE_CORRECTO}».'))
            return
        if rol.nombre_rol != NOMBRE_ANTERIOR:
            raise CommandError(f'El rol {ROL_ID} se llama «{rol.nombre_rol}»; se esperaba «{NOMBRE_ANTERIOR}». No se modifica.')
        if RolModel.objects.filter(nombre_rol=NOMBRE_CORRECTO).exists():
            raise CommandError(f'Ya existe otro rol llamado «{NOMBRE_CORRECTO}»: se evita un duplicado.')

        permisos_antes = RolPermisoModel.objects.filter(rol_id=ROL_ID).count()
        cuentas = CuentaEspejo.objects.filter(rol_id=ROL_ID).count()
        if opciones['dry_run']:
            self.stdout.write(f'[dry-run] Renombraría el rol {ROL_ID} ({cuentas} cuenta(s), {permisos_antes} permiso(s)).')
            return

        respaldo = self._respaldar(Path(opciones['respaldo_dir']), permisos_antes, cuentas)
        with transaction.atomic():
            RolModel.objects.filter(pk=ROL_ID, nombre_rol=NOMBRE_ANTERIOR).update(nombre_rol=NOMBRE_CORRECTO)
            sesiones = RepoPermisosVersionORM().incrementar_por_rol(ROL_ID)
            if RolPermisoModel.objects.filter(rol_id=ROL_ID).count() != permisos_antes:
                raise CommandError('La matriz de permisos del rol cambió durante el renombre: se revierte.')
        self.stdout.write(self.style.SUCCESS(
            f'Rol {ROL_ID} renombrado a «{NOMBRE_CORRECTO}»: 1 fila actualizada, {permisos_antes} permiso(s) intactos, '
            f'{sesiones} cuenta(s) con permisos_version incrementada. Respaldo: {respaldo}'
        ))

    def _respaldar(self, carpeta: Path, permisos: int, cuentas: int) -> Path:
        carpeta.mkdir(parents=True, exist_ok=True)
        destino = carpeta / f'USER_rol_respaldo_{datetime.now():%Y%m%d_%H%M%S}.json'
        contenido = {
            'tabla': 'USER_rol',
            'motivo': f'B14: {NOMBRE_ANTERIOR} -> {NOMBRE_CORRECTO} (rol {ROL_ID})',
            'filas': list(RolModel.objects.order_by('id').values('id', 'nombre_rol', 'descripcion_rol')),
            'rol_permisos_del_rol': sorted(
                RolPermisoModel.objects.filter(rol_id=ROL_ID).values_list('permiso__codigo', flat=True)
            ),
            'cuentas_del_rol': cuentas,
            'permisos_del_rol': permisos,
        }
        destino.write_text(json.dumps(contenido, ensure_ascii=False, indent=2), encoding='utf-8')
        return destino
