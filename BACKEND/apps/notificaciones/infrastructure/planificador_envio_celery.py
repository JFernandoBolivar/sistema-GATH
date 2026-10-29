"""
Programa el envío del correo DESPUÉS del commit (regla B22). Si el broker no responde no se revierte
nada: el mensaje ya está en el outbox y la tarea beat `notificaciones.reprocesar_outbox` lo recoge.
"""
import logging

from django.db import transaction

from core.infrastructure.tasks import CeleryTaskQueue

logger = logging.getLogger('gath.notificaciones')

TAREA_ENVIAR = 'notificaciones.enviar_correo_outbox'


class PlanificadorEnvioCelery:
    def __init__(self, cola=None):
        self._cola = cola or CeleryTaskQueue()

    def programar(self, outbox_id: str) -> None:
        def _encolar():
            try:
                self._cola.encolar(TAREA_ENVIAR, outbox_id=outbox_id)
            except Exception as exc:  # noqa: BLE001
                logger.error('no se pudo encolar el correo %s (lo reprocesará el beat): %s', outbox_id, exc)

        transaction.on_commit(_encolar)
