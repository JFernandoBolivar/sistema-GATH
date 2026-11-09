# Carga la app Celery al arrancar Django para que `@shared_task` la use.
from .celery import app as celery_app

__all__ = ('celery_app',)
