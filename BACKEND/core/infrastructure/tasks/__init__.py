from . import ping_tasks  # noqa: F401  (registra las tareas del núcleo en el worker)
from .celery_queue import CeleryTaskQueue

__all__ = ['CeleryTaskQueue']
