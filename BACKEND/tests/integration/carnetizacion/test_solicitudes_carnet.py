"""
Solicitudes de carnet (seguimiento A-6, decisión del 2026-11-20): el trabajador SOLICITA desde
Autogestión y Recursos Humanos emite o rechaza desde la bandeja de Carnetización.
"""
import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.repositories.repo_portal_trabajador_orm import (
    RepoPortalTrabajadorORM,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    SolicitudCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_comun as comun_mod
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

TRABAJADOR = '7720001'
OTRO = '7720002'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula):
        self.pk = 1
        self.id = None
        self.cedula_id = cedula
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture(scope='module')
def tablas_legadas(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        existentes = set(connection.introspection.table_names())
        with connection.schema_editor() as schema:
            for modelo in (MotivosEmisionModel, CarnetEmitidoModel):
                if modelo._meta.db_table not in existentes:
                    schema.create_model(modelo)
    yield


@pytest.fixture
def escenario(tablas_legadas, monkeypatch):
    monkeypatch.setattr(comun_mod, 'condicion_titular', lambda empleado: 'ACTIVO')
    monkeypatch.setattr(RepoPortalTrabajadorORM, 'puede_ver_carnet', lambda self, cedula: True)
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'V'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='F')
    for cedula, nombre in ((TRABAJADOR, 'ANA'), (OTRO, 'LUIS')):
        EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres=nombre, apellidos='SOLICITUD', sexoid=sexo, nacionalidad_id=1,
        )
    MotivosEmisionModel.objects.get_or_create(pk=1, defaults={'nombre': 'PRIMERA VEZ'})
    TipoCredencialModel.objects.get_or_create(codigo='trabajador', defaults={'nombre': 'Trabajador'})

    def cliente(cedula):
        api = APIClient()
        api.force_authenticate(user=Usuario(cedula))
        return api

    return {'trabajador': cliente(TRABAJADOR), 'rrhh': cliente(OTRO)}


def _solicitar(api, observaciones='Primera vez', motivo_id=1):
    return api.post(
        '/api/v1/autogestion/solicitar-carnet/',
        {'motivo_id': motivo_id, 'observaciones': observaciones},
        format='json',
    )


def test_el_trabajador_solicita_y_no_se_emite_carnet(escenario):
    respuesta = _solicitar(escenario['trabajador'])

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data['data']['estado'] == 'PENDIENTE'
    assert not CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=TRABAJADOR).exists()
    assert SolicitudCarnetModel.objects.get(cedula=TRABAJADOR).justificacion == 'Primera vez'


def test_no_se_permiten_dos_solicitudes_pendientes(escenario):
    assert _solicitar(escenario['trabajador']).status_code == 201
    segunda = _solicitar(escenario['trabajador'])

    assert segunda.status_code == 409
    assert SolicitudCarnetModel.objects.filter(cedula=TRABAJADOR).count() == 1


def test_sin_asignacion_vigente_no_se_puede_solicitar(escenario, monkeypatch):
    monkeypatch.setattr(comun_mod, 'condicion_titular', lambda empleado: 'SIN_ASIGNACION')

    assert _solicitar(escenario['trabajador']).status_code == 400
    assert not SolicitudCarnetModel.objects.exists()


def test_la_bandeja_lista_la_solicitud_con_los_datos_del_titular(escenario):
    _solicitar(escenario['trabajador'])

    respuesta = escenario['rrhh'].get('/api/v1/carnetizacion/solicitudes/', {'estado': 'PENDIENTE'})

    assert respuesta.status_code == 200
    [fila] = respuesta.data['data']
    assert fila['cedula'] == TRABAJADOR
    assert fila['nombres'] == 'ANA'
    assert fila['motivo'] == 'PRIMERA VEZ'
    assert fila['condicion'] == 'ACTIVO'
    assert fila['carnet_anterior_estado'] == 'NINGUNO'


def test_aprobar_emite_el_carnet_cierra_la_solicitud_y_avisa(escenario, django_capture_on_commit_callbacks):
    solicitud_id = _solicitar(escenario['trabajador']).data['data']['id']

    with django_capture_on_commit_callbacks(execute=True):
        respuesta = escenario['rrhh'].post(
            f'/api/v1/carnetizacion/generar/{TRABAJADOR}/',
            {'motivo_id': 1, 'solicitud_id': solicitud_id},
            format='json',
        )

    assert respuesta.status_code == 200
    assert respuesta['Content-Type'] == 'application/pdf'
    sol = SolicitudCarnetModel.objects.get(pk=solicitud_id)
    carnet = CarnetEmitidoModel.objects.get(employee__cedulaidentidad=TRABAJADOR, activo=True)
    assert sol.estado == 'APROBADA'
    assert sol.carnet_id == carnet.id
    assert sol.resuelta_por_cedula == OTRO
    assert NotificacionModel.objects.filter(
        destinatario_cedula=TRABAJADOR, tipo='CARNET_SOLICITUD_APROBADA',
    ).exists()


def test_no_se_aprueba_dos_veces_ni_con_la_cedula_equivocada(escenario):
    solicitud_id = _solicitar(escenario['trabajador']).data['data']['id']

    ajena = escenario['rrhh'].post(
        f'/api/v1/carnetizacion/generar/{OTRO}/', {'motivo_id': 1, 'solicitud_id': solicitud_id}, format='json',
    )
    assert ajena.status_code == 400
    assert not CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=OTRO).exists()

    url = f'/api/v1/carnetizacion/generar/{TRABAJADOR}/'
    assert escenario['rrhh'].post(url, {'motivo_id': 1, 'solicitud_id': solicitud_id}, format='json').status_code == 200
    repetida = escenario['rrhh'].post(url, {'motivo_id': 1, 'solicitud_id': solicitud_id}, format='json')
    assert repetida.status_code == 409


def test_rechazar_exige_motivo_y_avisa_al_trabajador(escenario, django_capture_on_commit_callbacks):
    solicitud_id = _solicitar(escenario['trabajador']).data['data']['id']
    url = f'/api/v1/carnetizacion/solicitudes/{solicitud_id}/rechazar/'

    assert escenario['rrhh'].post(url, {'motivo': '  '}, format='json').status_code == 400
    with django_capture_on_commit_callbacks(execute=True):
        respuesta = escenario['rrhh'].post(url, {'motivo': 'La foto no cumple el formato'}, format='json')

    assert respuesta.status_code == 200
    sol = SolicitudCarnetModel.objects.get(pk=solicitud_id)
    assert sol.estado == 'RECHAZADA'
    assert sol.motivo_rechazo == 'La foto no cumple el formato'
    assert not CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=TRABAJADOR).exists()
    assert NotificacionModel.objects.filter(
        destinatario_cedula=TRABAJADOR, tipo='CARNET_SOLICITUD_RECHAZADA',
    ).exists()


def test_el_trabajador_retira_su_solicitud_pero_no_la_ajena(escenario):
    solicitud_id = _solicitar(escenario['trabajador']).data['data']['id']
    url = f'/api/v1/autogestion/solicitud-carnet/{solicitud_id}/cancelar/'

    assert escenario['rrhh'].post(url).status_code == 404  # otro usuario: no la ve
    assert escenario['trabajador'].post(url).status_code == 200
    assert SolicitudCarnetModel.objects.get(pk=solicitud_id).estado == 'CANCELADA'
    # Retirada, puede volver a solicitar.
    assert _solicitar(escenario['trabajador']).status_code == 201


def test_mi_expediente_informa_la_ultima_solicitud(escenario):
    _solicitar(escenario['trabajador'])

    respuesta = escenario['trabajador'].get('/api/v1/autogestion/mi-expediente/')

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data['data']['solicitud_carnet']['estado'] == 'PENDIENTE'


def test_la_bandeja_reconoce_el_carnet_anterior_del_titular(escenario):
    """CarnetEmitido enlaza al empleado por id interno: la bandeja debe encontrarlo por cédula."""
    primera = _solicitar(escenario['trabajador']).data['data']['id']
    escenario['rrhh'].post(
        f'/api/v1/carnetizacion/generar/{TRABAJADOR}/', {'motivo_id': 1, 'solicitud_id': primera}, format='json',
    )
    CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=TRABAJADOR).update(activo=False)
    MotivosEmisionModel.objects.get_or_create(pk=2, defaults={'nombre': 'REPOSICION'})
    # Ya tuvo carnet: «primera vez» no aplica, se pide una reposición.
    assert _solicitar(escenario['trabajador'], 'Lo perdí', motivo_id=2).status_code == 201

    filas = escenario['rrhh'].get('/api/v1/carnetizacion/solicitudes/', {'estado': 'PENDIENTE'}).data['data']

    assert [f['carnet_anterior_estado'] for f in filas] == ['VENCIDO']


def test_mi_expediente_cacheado_se_actualiza_al_solicitar_y_al_emitir(escenario):
    """«Mi expediente» se cachea 5 min: solicitar y emitir deben invalidarlo (antes, la emisión
    invalidaba con el id interno del empleado y el trabajador seguía viendo «sin carnet»)."""
    url = '/api/v1/autogestion/mi-expediente/'
    antes = escenario['trabajador'].get(url).data['data']  # deja el expediente en caché
    assert antes['solicitud_carnet'] is None
    assert antes['carnet_activo'] is None

    solicitud_id = _solicitar(escenario['trabajador']).data['data']['id']
    assert escenario['trabajador'].get(url).data['data']['solicitud_carnet']['estado'] == 'PENDIENTE'

    escenario['rrhh'].post(
        f'/api/v1/carnetizacion/generar/{TRABAJADOR}/', {'motivo_id': 1, 'solicitud_id': solicitud_id},
        format='json',
    )
    despues = escenario['trabajador'].get(url).data['data']
    assert despues['solicitud_carnet']['estado'] == 'APROBADA'
    assert despues['carnet_activo'] is not None
