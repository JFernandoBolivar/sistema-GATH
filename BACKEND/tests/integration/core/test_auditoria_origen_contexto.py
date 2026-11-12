"""El origen de la petición/tarea completa la auditoría cuando no se pasa explícito."""
import pytest
from django.test import RequestFactory

from core.infrastructure.auditoria_contexto import (
    con_origen_de_tarea,
    fijar_origen,
    limpiar_origen,
    obtener_origen,
)
from core.presentation.audit import registrar_auditoria
from core.presentation.auditoria_middleware import OrigenAuditoriaMiddleware

pytestmark = pytest.mark.django_db

ORIGEN = {
    'ip_origen': '10.1.2.3',
    'user_agent': 'Mozilla/5.0 (X11; Linux x86_64)',
    'dispositivo': 'ESCRITORIO',
}


def test_registrar_auditoria_completa_desde_el_contexto():
    fijar_origen(ORIGEN)
    try:
        registro = registrar_auditoria(
            trace_id='t-contexto', actor_id=None, accion='prueba_contexto', modulo='core',
        )
    finally:
        limpiar_origen()

    assert registro.ip_origen == ORIGEN['ip_origen']
    assert registro.user_agent == ORIGEN['user_agent']
    assert registro.dispositivo == ORIGEN['dispositivo']


def test_los_valores_explicitos_no_se_sobrescriben():
    fijar_origen(ORIGEN)
    try:
        registro = registrar_auditoria(
            trace_id='t-explicito', actor_id=None, accion='prueba_explicita', modulo='core',
            ip_origen='192.0.2.99', user_agent='UA-propio', dispositivo='MOVIL',
        )
    finally:
        limpiar_origen()

    assert registro.ip_origen == '192.0.2.99'
    assert registro.user_agent == 'UA-propio'
    assert registro.dispositivo == 'MOVIL'


def test_sin_contexto_la_auditoria_queda_sin_origen():
    limpiar_origen()

    registro = registrar_auditoria(
        trace_id='t-sin-contexto', actor_id=None, accion='prueba_sin_contexto', modulo='core',
    )

    assert registro.ip_origen is None
    assert registro.user_agent == ''
    assert registro.dispositivo == 'DESCONOCIDO'


def test_middleware_fija_y_limpia_el_origen():
    request = RequestFactory().get(
        '/', REMOTE_ADDR='192.0.2.10', HTTP_USER_AGENT='Mozilla/5.0 (iPhone)',
    )
    visto = {}

    def vista(req):
        visto.update(obtener_origen())
        return 'respuesta'

    respuesta = OrigenAuditoriaMiddleware(vista)(request)

    assert respuesta == 'respuesta'
    assert visto['ip_origen'] == '192.0.2.10'
    assert 'iPhone' in visto['user_agent']
    assert visto['dispositivo']
    assert obtener_origen() == {}


def test_el_decorador_de_tarea_fija_y_limpia_el_origen():
    @con_origen_de_tarea
    def tarea():
        return obtener_origen()

    assert tarea(origen=ORIGEN) == ORIGEN
    assert obtener_origen() == {}


def test_el_decorador_sin_origen_no_falla():
    @con_origen_de_tarea
    def tarea():
        return obtener_origen()

    assert tarea() == {}
