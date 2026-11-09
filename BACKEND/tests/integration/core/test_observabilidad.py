"""E3: traza HTTP, propagación a Celery y aviso de outbox fallido."""
import pytest
from rest_framework.test import APIClient

from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from core.infrastructure.tasks.celery_queue import CeleryTaskQueue

pytestmark = pytest.mark.django_db


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.cedula_id = 'V-1'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def test_respuesta_ecoa_el_trace_id_recibido():
    respuesta = APIClient().get(
        '/api/v1/identidad/auth/me/', HTTP_X_TRACE_ID='trace-frontend-1',
    )
    assert respuesta.headers['X-Request-ID'] == 'trace-frontend-1'


def test_respuesta_genera_trace_id_si_no_viene():
    respuesta = APIClient().get('/api/v1/identidad/auth/me/')
    assert len(respuesta.headers['X-Request-ID']) >= 16


def test_la_cola_propaga_trace_id_en_los_headers():
    class AppFalsa:
        def __init__(self):
            self.llamada = None

        def send_task(self, nombre, **kwargs):
            self.llamada = (nombre, kwargs)
            return type('Resultado', (), {'id': 'task-1'})()

    app = AppFalsa()
    CeleryTaskQueue(celery_app=app).encolar('core.ping', origen='test')
    assert app.llamada[0] == 'core.ping'
    assert app.llamada[1]['headers']['trace_id']


def _cliente(permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def test_outbox_fallidos_expone_total_y_ultimos():
    EventoOutboxModel.objects.create(
        tipo='aviso', destinatario='a@ejemplo.com', idempotency_key='k1',
        estado=EventoOutboxModel.Estado.FALLIDO, intentos=5, ultimo_error='SMTP error',
    )
    EventoOutboxModel.objects.create(
        tipo='aviso', destinatario='b@ejemplo.com', idempotency_key='k2',
        estado=EventoOutboxModel.Estado.ENVIADO,
    )
    respuesta = _cliente({'notificaciones.administrar'}).get(
        '/api/v1/notificaciones/outbox/fallidos/',
    )
    assert respuesta.status_code == 200
    datos = respuesta.json()['data']
    assert datos['total'] == 1
    assert datos['ultimos'][0]['destinatario'] == 'a@ejemplo.com'
    assert datos['ultimos'][0]['intentos'] == 5


def test_outbox_fallidos_exige_permiso():
    respuesta = _cliente({'notificaciones.ver_propias'}).get(
        '/api/v1/notificaciones/outbox/fallidos/',
    )
    assert respuesta.status_code == 403
