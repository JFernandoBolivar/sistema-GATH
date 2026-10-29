"""Auditoría con user_agent (Etapa A6)."""
import pytest
from rest_framework.test import APIRequestFactory

from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.audit import origen_de_peticion, registrar_auditoria


def test_origen_de_peticion_toma_ip_y_user_agent_recortado():
    req = APIRequestFactory().get('/x', HTTP_USER_AGENT='A' * 400, REMOTE_ADDR='10.0.0.5')
    origen = origen_de_peticion(req)
    assert origen['ip_origen'] == '10.0.0.5'
    assert len(origen['user_agent']) == 255


@pytest.mark.django_db
def test_registrar_auditoria_persiste_user_agent():
    req = APIRequestFactory().get('/x', HTTP_USER_AGENT='Mozilla/5.0 (Test)', REMOTE_ADDR='10.0.0.9')
    registro = registrar_auditoria(
        trace_id='t-1', actor_id=1, accion='probar', modulo='core', **origen_de_peticion(req)
    )
    guardado = AuditoriaLog.objects.get(pk=registro.pk)
    assert guardado.user_agent == 'Mozilla/5.0 (Test)'
    assert guardado.ip_origen == '10.0.0.9'


@pytest.mark.django_db
def test_user_agent_es_opcional():
    registro = registrar_auditoria(trace_id='t-2', actor_id=None, accion='probar', modulo='core')
    assert AuditoriaLog.objects.get(pk=registro.pk).user_agent == ''
