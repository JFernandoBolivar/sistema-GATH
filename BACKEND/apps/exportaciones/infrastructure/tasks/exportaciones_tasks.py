"""
Tareas Celery de las exportaciones asíncronas.

- `exportaciones.generar`: genera el archivo con el mismo generador de las vistas
  síncronas, lo sube a SeaweedFS con clave no adivinable y marca el trabajo
  LISTO. Recibe solo el id del trabajo (los filtros viven en la fila, no en el
  mensaje del broker). Si el almacén no responde reintenta con backoff
  exponencial (2 veces); agotados los reintentos el trabajo queda en ERROR.
- `exportaciones.purgar` (beat): cancela trabajos atascados, borra del almacén los
  archivos vencidos y elimina las filas viejas.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.conf import settings

from apps.exportaciones.application.use_cases.gestionar_exportaciones import (
    ejecutar_exportacion,
    fallar_exportacion,
    purgar_exportaciones,
)
from apps.exportaciones.infrastructure.auditor import auditor_de_tarea
from apps.exportaciones.infrastructure.generadores import GeneradorExportacionDjango
from apps.exportaciones.infrastructure.repositories.repo_exportaciones_orm import (
    RepoExportacionesORM,
)
from core.domain.exceptions import AlmacenamientoNoDisponible
from core.infrastructure.auditoria_contexto import con_origen_de_tarea
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger('gath.tasks')

MAX_REINTENTOS = 2
BACKOFF_BASE_SEGUNDOS = 15


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


@shared_task(
    bind=True, name='exportaciones.generar', acks_late=True, max_retries=MAX_REINTENTOS,
    time_limit=900, soft_time_limit=840,
)
@con_origen_de_tarea
def generar_exportacion(self, trabajo_id: str) -> str:
    repo = RepoExportacionesORM()
    auditar = auditor_de_tarea()
    try:
        estado = ejecutar_exportacion(
            repo, GeneradorExportacionDjango(), SeaweedFSStorage(), auditar, trabajo_id, _ahora,
        )
    except AlmacenamientoNoDisponible as exc:
        if self.request.retries >= self.max_retries:
            fallar_exportacion(
                repo, auditar, trabajo_id,
                'El almacenamiento de archivos no está disponible. Intente más tarde.', _ahora(),
            )
            return 'ERROR'
        raise self.retry(exc=exc, countdown=BACKOFF_BASE_SEGUNDOS * (2 ** self.request.retries))
    return estado.value if estado else 'INEXISTENTE'


@shared_task(name='exportaciones.purgar', acks_late=True)
def purgar() -> dict:
    resultado = purgar_exportaciones(
        RepoExportacionesORM(),
        SeaweedFSStorage(),
        _ahora(),
        retencion_filas_dias=settings.EXPORTACIONES_RETENCION_FILAS_DIAS,
        max_minutos_en_curso=settings.EXPORTACIONES_MAX_MINUTOS_EN_CURSO,
    )
    logger.info('exportaciones.purga', extra=resultado)
    return resultado
