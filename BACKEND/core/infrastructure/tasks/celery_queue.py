"""
Implementación de TaskQueue para Celery y RabbitMQ (D-02, B5.2).

Cumple con el contrato TaskQueue de `core.domain.ports`.
Permite encolar tareas asíncronas sin que los casos de uso importen Celery
directamente (regla B20: desacoplamiento del framework asíncrono).
"""
import logging
from typing import Any

from django.conf import settings

from core.domain.exceptions import ColaTareasNoDisponible

logger = logging.getLogger('gath.tasks')


class CeleryTaskQueue:
    """Adaptador de cola de tareas sobre Celery / RabbitMQ."""

    def __init__(self, celery_app=None):
        self._celery_app = celery_app

    def _get_app(self):
        if self._celery_app is None:
            if not getattr(settings, 'CELERY_BROKER_URL', ''):
                logger.error("CELERY_BROKER_URL no está configurada: la cola de tareas no está disponible.")
                return None
            try:
                from GATH.celery import app as default_app
                self._celery_app = default_app
            except ImportError:
                logger.error("GATH.celery no es importable: la cola de tareas no está disponible.")
                self._celery_app = None
        return self._celery_app

    def encolar(self, nombre_tarea: str, **kwargs: Any) -> str:
        """Encola una tarea por su nombre canónico y retorna su task_id."""
        app = self._get_app()
        if app is not None:
            try:
                async_result = app.send_task(nombre_tarea, kwargs=kwargs)
                logger.info("Tarea %s encolada con ID: %s", nombre_tarea, async_result.id)
                return str(async_result.id)
            except Exception as exc:
                logger.error("Error al encolar tarea Celery %s: %s", nombre_tarea, exc)
                raise ColaTareasNoDisponible(
                    "No fue posible encolar la tarea en segundo plano."
                ) from exc
        # Sin app Celery no hay quien ejecute la tarea: fallar explícito en vez
        # de devolver un task_id inventado que aparente éxito.
        logger.error("No hay app Celery configurada: no se pudo encolar %s.", nombre_tarea)
        raise ColaTareasNoDisponible("El servicio de tareas en segundo plano no está disponible.")
