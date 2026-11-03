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


# --- Sonda de vida barata del worker -----------------------------------------
# El healthcheck de compose usaba `celery inspect ping`: cada 30 s arrancaba un
# proceso Python completo (Django + broker) y consumía ~1-2 s de CPU, lo que
# producía picos de latencia en Django sobre el mismo host. Ahora el propio
# worker toca un archivo cada 15 s desde su temporizador y el healthcheck solo
# compara la fecha de modificación (ver compose.yml).
from pathlib import Path  # noqa: E402

from celery import bootsteps  # noqa: E402

HEARTBEAT_FILE = Path(os.environ.get('CELERY_HEARTBEAT_FILE', '/tmp/celery_worker_heartbeat'))
HEARTBEAT_INTERVAL_S = 15.0


class SondaVidaWorker(bootsteps.StartStopStep):
    """Toca `HEARTBEAT_FILE` periódicamente mientras el worker está vivo."""

    requires = {'celery.worker.components:Timer'}

    def __init__(self, worker, **kwargs):
        super().__init__(worker, **kwargs)
        self.tref = None

    def start(self, worker):
        self.latido(worker)
        self.tref = worker.timer.call_repeatedly(
            HEARTBEAT_INTERVAL_S, self.latido, (worker,), priority=10,
        )

    def stop(self, worker):
        if self.tref is not None:
            self.tref.cancel()
        HEARTBEAT_FILE.unlink(missing_ok=True)

    def latido(self, worker):
        HEARTBEAT_FILE.touch()


app.steps['worker'].add(SondaVidaWorker)
