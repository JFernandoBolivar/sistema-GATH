"""
Aplicación Celery de GATH (Etapa A1, D-02).

Broker RabbitMQ (vhost `gath`) y resultados en Redis (db 1); ambos se leen del
entorno en `settings.py` (prefijo `CELERY_`). Las tareas viven en
`apps/<modulo>/infrastructure/tasks/` y `core/infrastructure/tasks/`; los casos
de uso las encolan por nombre a través del puerto `TaskQueue` (nunca `.delay()`).
"""
import os

from celery import Celery
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'GATH.settings')

app = Celery('gath')
app.config_from_object('django.conf:settings', namespace='CELERY')
# Convención Onion: las tareas de cada app viven en `<app>.infrastructure.tasks`.
app.autodiscover_tasks(
    lambda: [a for a in settings.INSTALLED_APPS if a == 'core' or a.startswith('apps.')],
    related_name='infrastructure.tasks',
)
