"""
GATH · Fase 2 — bosquejo de la app de Celery (§12.6)

Ubicación final: BACKEND/SIGEP/celery.py
Y en BACKEND/SIGEP/__init__.py:

    from .celery import app as celery_app
    __all__ = ('celery_app',)

Es un bosquejo: la configuración es la propuesta, los nombres de tarea
dependen de los módulos que se creen en las etapas E-2 a E-9.
"""
import os
from celery import Celery
from celery.schedules import crontab
from decouple import config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SIGEP.settings')

app = Celery('gath')

app.conf.update(
    broker_url=config('CELERY_BROKER_URL'),      # sin default: si falta, falla al arrancar
    result_backend='django-db',                   # PostgreSQL; no se introduce Redis

    # ── Garantías de entrega ────────────────────────────────────────────────
    task_acks_late=True,                # ack DESPUÉS de ejecutar, no al recibir
    task_reject_on_worker_lost=True,    # si el worker muere, el mensaje se reencola
    worker_prefetch_multiplier=1,       # nadie acapara mensajes
    broker_transport_options={'confirm_publish': True},
    broker_connection_retry_on_startup=True,

    # ── Límites ─────────────────────────────────────────────────────────────
    task_time_limit=300,
    task_soft_time_limit=270,
    worker_max_tasks_per_child=200,     # acota fugas de memoria en reportlab

    # ── Enrutamiento por cola (§12.6) ───────────────────────────────────────
    task_default_queue='maint',
    task_routes={
        'sincronizacion.*': {'queue': 'sync'},
        'documentos.*':     {'queue': 'docs'},
        'notificaciones.*': {'queue': 'mail'},
    },

    timezone='America/Caracas',
    enable_utc=True,
)

app.autodiscover_tasks()


# ─────────────────────────────────────────────────────────────────────────────
# Calendario inicial (§12.7).
#
# Se siembra una sola vez con django-celery-beat; a partir de ahí el calendario
# vive en la base y se ajusta desde el admin sin desplegar. Este diccionario es
# la semilla, no la fuente de verdad.
# ─────────────────────────────────────────────────────────────────────────────
app.conf.beat_schedule = {
    'expirar-credenciales': {
        'task': 'postulacion.expirar_credenciales',
        'schedule': crontab(minute='*/15'),
    },
    'liberar-reservas-vencidas': {
        'task': 'postulacion.liberar_reservas_vencidas',
        'schedule': crontab(minute=5),                    # cada hora
    },
    'expirar-solicitudes-autogestion': {
        'task': 'autogestion.expirar_solicitudes',
        'schedule': crontab(minute=10),
    },
    'recordar-vencimientos': {
        'task': 'notificaciones.recordar_vencimientos',   # avisa 48 h antes
        'schedule': crontab(hour=8, minute=0),
    },
    'reencolar-outbox-pendiente': {
        # Red de seguridad: si RabbitMQ estuvo caído, el outbox retuvo los
        # eventos en PENDIENTE y esto los despacha. La cola es el transporte,
        # no la fuente de verdad.
        'task': 'sincronizacion.reencolar_pendientes',
        'schedule': crontab(minute='*/10'),
    },
    'conciliar-sigep': {
        'task': 'sincronizacion.conciliar',
        'schedule': crontab(hour=3, minute=0),
    },
    'purgar-expedientes-rechazados': {
        # NO borra nada mientras RETENCION_EXPEDIENTE_RECHAZADO_DIAS esté vacío.
        # Depende de DEC-3.
        'task': 'postulacion.purgar_rechazados',
        'schedule': crontab(hour=4, minute=0),
    },
    'respaldar-metadatos-filer': {
        'task': 'sincronizacion.respaldar_metadatos_filer',
        'schedule': crontab(hour=2, minute=30),
    },
}
