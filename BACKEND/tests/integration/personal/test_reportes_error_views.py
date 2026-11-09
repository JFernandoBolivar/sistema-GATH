import pytest
from unittest.mock import MagicMock
from rest_framework.test import APIClient
from apps.personal.infrastructure.models.reporte_error_models import ReporteErrorDatoLaboralModel
from apps.personal.domain.entities.reporte_error import DatoLaboralReportado, EstadoReporteError


class MockUsuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos=None, pk=100, nombre='Usuario Prueba'):
        self.cedula_id = cedula
        self.cedula = cedula
        self.pk = pk
        self.id = pk
        self.nombre_completo = nombre
        self._permisos = set(permisos or [])

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


@pytest.fixture(autouse=True)
def deshabilitar_notificador(monkeypatch):
    mock_notif = MagicMock()
    monkeypatch.setattr(
        'apps.personal.presentation.views.reportes_error_views.obtener_notificador',
        lambda: mock_notif,
    )
    return mock_notif


@pytest.mark.django_db
def test_trabajador_crea_reporte_error_laboral_ok():
    client = APIClient()
    user = MockUsuario(cedula='12345678', permisos=['autogestion.solicitar_actualizacion'])
    client.force_authenticate(user=user)

    url = '/api/v1/personal/reportes-error/crear/'
    payload = {
        'dato': 'cargo',
        'descripcion': 'El cargo asignado en el sistema figura como Analista pero soy Especialista.',
    }
    resp = client.post(url, payload, format='json')
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert data.get('status') == 'success'
    assert data['data']['dato'] == 'cargo'
    assert data['data']['estado'] == 'PENDIENTE'
    assert data['data']['trabajador_cedula'] == '12345678'

    # Verificar en BD
    reporte_db = ReporteErrorDatoLaboralModel.objects.get(trabajador_cedula='12345678')
    assert reporte_db.dato == DatoLaboralReportado.CARGO.value
    assert reporte_db.estado == EstadoReporteError.PENDIENTE.value


@pytest.mark.django_db
def test_trabajador_crea_reporte_error_laboral_validacion_falla():
    client = APIClient()
    user = MockUsuario(cedula='12345678')
    client.force_authenticate(user=user)

    url = '/api/v1/personal/reportes-error/crear/'
    # Muy corta (< 10 caracteres)
    payload = {'dato': 'cargo', 'descripcion': 'Corta'}
    resp = client.post(url, payload, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_listar_reportes_requiere_permiso():
    client = APIClient()
    user_sin_permiso = MockUsuario(cedula='12345678', permisos=[])
    client.force_authenticate(user=user_sin_permiso)

    url = '/api/v1/personal/reportes-error/'
    resp = client.get(url)
    assert resp.status_code == 403

    # Con permiso
    user_con_permiso = MockUsuario(cedula='88888888', permisos=['personal.reportes_error_ver'])
    client.force_authenticate(user=user_con_permiso)
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json().get('status') == 'success'


@pytest.mark.django_db
def test_rrhh_atiende_reporte_ok():
    client = APIClient()
    # Crear reporte primero
    user_trabajador = MockUsuario(cedula='12345678')
    client.force_authenticate(user=user_trabajador)
    resp_crear = client.post('/api/v1/personal/reportes-error/crear/', {
        'dato': 'oficina',
        'descripcion': 'Mi oficina actual es Consultoria Juridica y no Presidencia.',
    }, format='json')
    reporte_id = resp_crear.json()['data']['id']

    # Analista de RRHH atiende
    user_rrhh = MockUsuario(cedula='99999999', pk=77, nombre='Analista RRHH', permisos=['personal.reportes_error_ver'])
    client.force_authenticate(user=user_rrhh)

    url_atender = f'/api/v1/personal/reportes-error/{reporte_id}/atender/'
    resp_atender = client.post(url_atender, {
        'observaciones': 'Se verifica resolucion y se actualiza en personal.',
    }, format='json')

    assert resp_atender.status_code == 200, resp_atender.content
    data = resp_atender.json()['data']
    assert data['estado'] == 'ATENDIDO'
    assert data['atendido_por_cedula'] == '99999999'
