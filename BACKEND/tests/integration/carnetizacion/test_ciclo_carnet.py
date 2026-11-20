"""Ciclo físico del carnet por la API (B-5): imprimir, entregar y anular con motivo."""
import pytest
from django.db import connection, transaction
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
)
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_comun as comun_mod
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CEDULA = '7740001'


class Usuario:
    is_authenticated = True
    is_active = True
    pk = 1
    id = None
    cedula_id = '7749999'
    rol_id = None

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
def carnet(tablas_legadas, monkeypatch):
    monkeypatch.setattr(comun_mod, 'condicion_titular', lambda empleado: 'ACTIVO')
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'V'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='F')
    EmployeeModel.objects.create(cedulaidentidad=CEDULA, nombres='ANA', apellidos='CICLO', sexoid=sexo,
                                 nacionalidad_id=1)
    MotivosEmisionModel.objects.get_or_create(pk=1, defaults={'nombre': 'PRIMERA VEZ'})
    with transaction.atomic():
        return RepoCarnetizacionORM().emitir_carnet(CEDULA, 1)


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def _url(carnet, accion):
    return f'/api/v1/carnetizacion/{carnet.id}/{accion}/'


def test_ciclo_completo_emitido_impreso_entregado(api, carnet, django_capture_on_commit_callbacks):
    assert api.get(_url(carnet, 'estado')).data['data']['estado'] == 'EMITIDO'
    # No se entrega sin imprimir.
    assert api.post(_url(carnet, 'entregado'), {'recibido_por': 'ANA CICLO'}, format='json').status_code == 409

    with django_capture_on_commit_callbacks(execute=True):
        impreso = api.post(_url(carnet, 'impreso'))
    assert impreso.status_code == 200
    assert impreso.data['data']['estado'] == 'IMPRESO'
    assert NotificacionModel.objects.filter(destinatario_cedula=CEDULA, tipo='CARNET_LISTO_PARA_RETIRAR').exists()
    assert api.post(_url(carnet, 'impreso')).status_code == 409

    assert api.post(_url(carnet, 'entregado'), {'recibido_por': ' '}, format='json').status_code == 400
    entregado = api.post(_url(carnet, 'entregado'), {'recibido_por': 'ANA CICLO (titular)'}, format='json')
    assert entregado.status_code == 200
    datos = entregado.data['data']
    assert datos['estado'] == 'ENTREGADO'
    assert datos['recibido_por'] == 'ANA CICLO (titular)'
    assert datos['fecha_impresion'] and datos['fecha_entrega']


def test_anular_exige_motivo_y_desactiva_el_carnet(api, carnet):
    assert api.post(_url(carnet, 'revocar'), {}, format='json').status_code == 400
    assert CarnetEmitidoModel.objects.get(pk=carnet.id).activo is True

    anulado = api.post(_url(carnet, 'revocar'), {'motivo': 'Extravío reportado'}, format='json')

    assert anulado.status_code == 200
    assert anulado.data['data']['estado'] == 'ANULADO'
    assert anulado.data['data']['motivo_anulacion'] == 'Extravío reportado'
    assert CarnetEmitidoModel.objects.get(pk=carnet.id).activo is False
    assert api.post(_url(carnet, 'revocar'), {'motivo': 'otra vez'}, format='json').status_code == 409
    assert api.post(_url(carnet, 'impreso')).status_code == 409


def test_la_busqueda_de_la_consola_informa_el_estado_fisico(api, carnet):
    api.post(_url(carnet, 'impreso'))

    [fila] = [f for f in RepoCarnetizacionORM().buscar_personal(CEDULA) if f['cedula'] == CEDULA]

    assert fila['carnet_activo_id'] == carnet.id
    assert fila['carnet_activo_estado'] == 'IMPRESO'
