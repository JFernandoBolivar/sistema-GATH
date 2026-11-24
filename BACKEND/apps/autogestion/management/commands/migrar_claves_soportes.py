"""Migra las claves de soportes de autogestión que llevan la cédula en la ruta (H-2) a claves opacas.

Antes: `autogestion/soportes/{cedula}/{solicitud}/{uuid}{ext}`. Ahora: `autogestion/soportes/{uuid}{ext}`.
Por cada clave vieja distinta: (1) copia el objeto a una clave nueva; si la copia falla no toca ninguna fila;
(2) actualiza en UNA transacción las filas de soporte y la foto del empleado (`profile`/`foto_objeto`) que
la usaban; (3) solo después borra el objeto viejo. Idempotente: lo ya migrado no vuelve a aparecer.

Por defecto corre en seco (solo informa). `--aplicar` ejecuta la migración.

Uso:
    python manage.py migrar_claves_soportes
    python manage.py migrar_claves_soportes --aplicar
"""
import logging
import uuid
from collections import defaultdict
from pathlib import PurePosixPath

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.autogestion.application.use_cases.edicion_trabajador import PREFIJO_CLAVE_SOPORTES
from apps.autogestion.infrastructure.models.actualizacion_models import SoporteDocumentalModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger(__name__)


def tiene_cedula_en_la_ruta(clave: str) -> bool:
    """Ruta antigua: `autogestion/soportes/{cedula}/{solicitud}/{archivo}` (la nueva solo tiene el archivo)."""
    return clave.startswith(f'{PREFIJO_CLAVE_SOPORTES}/') and len(clave.split('/')) > 3


def migrar_claves(almacen, aplicar: bool) -> dict:
    """Devuelve el resumen: encontradas, migradas, fallidas, huerfanas (viejas sin borrar) y filas tocadas."""
    grupos = defaultdict(list)
    for soporte in SoporteDocumentalModel.objects.filter(clave_s3__startswith=f'{PREFIJO_CLAVE_SOPORTES}/'):
        if tiene_cedula_en_la_ruta(soporte.clave_s3):
            grupos[soporte.clave_s3].append(soporte)
    resumen = {'encontradas': len(grupos), 'migradas': 0, 'fallidas': 0, 'huerfanas': [], 'filas': 0}
    if not aplicar:
        return resumen
    for vieja, filas in grupos.items():
        extension = PurePosixPath(vieja).suffix
        nueva = f'{PREFIJO_CLAVE_SOPORTES}/{uuid.uuid4().hex}{extension}'
        try:
            almacen.subir(nueva, almacen.descargar(vieja), filas[0].mime_real or 'application/octet-stream')
        except Exception:  # noqa: BLE001 - la copia falló: no se toca ninguna fila
            logger.exception('No se pudo copiar el soporte %s; se deja la clave vieja', vieja)
            resumen['fallidas'] += 1
            continue
        try:
            with transaction.atomic():
                tocadas = SoporteDocumentalModel.objects.filter(clave_s3=vieja).update(clave_s3=nueva)
                EmployeeModel.objects.filter(profile=vieja).update(profile=nueva)
                EmployeeModel.objects.filter(foto_objeto=vieja).update(foto_objeto=nueva)
        except Exception:  # noqa: BLE001 - la base falló: se descarta la copia y se conserva la vieja
            logger.exception('No se pudo actualizar la clave de %s; se descarta la copia', vieja)
            resumen['fallidas'] += 1
            _borrar_sin_fallar(almacen, nueva)
            continue
        resumen['filas'] += tocadas
        resumen['migradas'] += 1
        try:
            almacen.eliminar(vieja)
        except Exception:  # noqa: BLE001 - la fila ya apunta a la nueva; la vieja queda huérfana
            logger.exception('No se pudo borrar el objeto viejo %s', vieja)
            resumen['huerfanas'].append(vieja)
    return resumen


def _borrar_sin_fallar(almacen, clave: str) -> None:
    try:
        almacen.eliminar(clave)
    except Exception:  # noqa: BLE001
        logger.exception('No se pudo borrar la copia %s', clave)


class Command(BaseCommand):
    help = 'Migra los soportes de autogestión con la cédula en la clave a claves opacas (en seco por defecto).'

    def add_arguments(self, parser):
        parser.add_argument('--aplicar', action='store_true', default=False,
                            help='Ejecuta la migración. Sin este indicador solo informa (en seco).')

    def handle(self, *args, **opciones):
        aplicar = opciones['aplicar']
        resumen = migrar_claves(SeaweedFSStorage(), aplicar)
        modo = 'APLICADO' if aplicar else 'EN SECO (use --aplicar para migrar)'
        self.stdout.write(f'Modo: {modo}')
        self.stdout.write(f"Claves con cédula en la ruta: {resumen['encontradas']}")
        if aplicar:
            self.stdout.write(
                f"Migradas: {resumen['migradas']} | filas actualizadas: {resumen['filas']} | "
                f"fallidas: {resumen['fallidas']} | objetos viejos sin borrar: {len(resumen['huerfanas'])}"
            )
            for clave in resumen['huerfanas']:
                self.stdout.write(f'  huérfano: {clave}')
