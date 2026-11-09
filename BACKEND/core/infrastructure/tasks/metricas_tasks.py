"""Métrica periódica de la cola Celery (E3).

No pretende ser un sistema de métricas completo: deja una línea JSON al día
operativo con la profundidad de la cola y las tareas activas, suficiente para
detectar acumulación o workers caídos desde los logs del contenedor.
"""
import logging

from celery import shared_task
from django.conf import settings

logger = logging.getLogger('gath.tasks')


@shared_task(name='core.metricas_cola', acks_late=True)
def metricas_cola() -> int:
    from GATH.celery import app

    cola = getattr(settings, 'CELERY_TASK_DEFAULT_QUEUE', 'gath')
    profundidad = -1
    activas = -1
    try:
        with app.connection_for_read() as conexion:
            canal = conexion.channel()
            declarada = canal.queue_declare(queue=cola, passive=True)
            profundidad = declarada.message_count
        inspeccion = app.control.inspect(timeout=2)
        activas = sum(len(v) for v in (inspeccion.active() or {}).values()) if inspeccion else 0
    except Exception as exc:  # noqa: BLE001 - la métrica nunca tumba al worker
        logger.warning(
            'celery.queue.metrica',
            extra={'queue': cola, 'depth': profundidad, 'error': str(exc)[:300]},
        )
        return profundidad
    logger.info(
        'celery.queue.metrica',
        extra={'queue': cola, 'depth': profundidad, 'active_tasks': activas},
    )
    return profundidad
