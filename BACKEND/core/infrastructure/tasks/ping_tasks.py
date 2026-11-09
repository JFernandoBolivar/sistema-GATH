"""Tarea de diagnóstico `core.ping`: confirma que el worker consume y responde."""
import logging

from celery import shared_task

logger = logging.getLogger('gath.tasks')


@shared_task(name='core.ping', acks_late=True)
def ping(origen: str = 'manual') -> str:
    logger.info("core.ping recibido (origen=%s)", origen)
    return f'pong:{origen}'
