"""
Tareas Celery del correo saliente (A3). Reciben solo el id del outbox (B23): nunca el contenido ni adjuntos.

- `notificaciones.enviar_correo_outbox`: envía un mensaje (idempotente, bloquea la fila) y, si falla,
  se reprograma a sí misma con backoff exponencial hasta `NOTIFICACIONES_CORREO_MAX_INTENTOS`.
- `notificaciones.reprocesar_outbox` (beat): red de seguridad para PENDIENTES que nadie envió.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.conf import settings
from django.db import transaction

from apps.notificaciones.application.use_cases.correo_outbox import enviar_correo, reprocesar_pendientes
from apps.notificaciones.infrastructure.enviador_correo_django import EnviadorCorreoDjango
from apps.notificaciones.infrastructure.planificador_envio_celery import PlanificadorEnvioCelery
from apps.notificaciones.infrastructure.repositories.repo_outbox_orm import RepoOutboxORM
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger('gath.tasks')


@shared_task(bind=True, name='notificaciones.enviar_correo_outbox', acks_late=True)
def enviar_correo_outbox(self, outbox_id: str) -> str:
    with transaction.atomic():
        resultado = enviar_correo(
            RepoOutboxORM(), EnviadorCorreoDjango(), SeaweedFSStorage(), outbox_id, datetime.now(timezone.utc),
            max_intentos=settings.NOTIFICACIONES_CORREO_MAX_INTENTOS,
            backoff_base=settings.NOTIFICACIONES_CORREO_BACKOFF_SEGUNDOS,
            url_base=settings.FRONTEND_URL,
        )
    if resultado.estado == 'REINTENTAR':
        self.apply_async(args=[outbox_id], countdown=resultado.reintentar_en)
    return resultado.estado


@shared_task(name='notificaciones.reprocesar_outbox', acks_late=True)
def reprocesar_outbox() -> int:
    total = reprocesar_pendientes(RepoOutboxORM(), PlanificadorEnvioCelery(), datetime.now(timezone.utc))
    # on_commit se ejecuta de inmediato fuera de una transacción: nada más que hacer.
    if total:
        logger.info('notificaciones.reprocesar_outbox: %s mensaje(s) reprogramado(s)', total)
    return total
