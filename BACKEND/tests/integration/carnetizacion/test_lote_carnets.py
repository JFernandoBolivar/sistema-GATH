"""Impresión por lote de carnets de trabajadores (B-6): cola de impresión y PDF del lote."""
import re

import pytest
from django.db import connection, transaction
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetCicloModel,
    CarnetEmitidoModel,
    MotivosEmisionModel,
)
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_comun as comun_mod
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CEDULAS = ('7750001', '7750002', '7750003')


class Usuario:
    is_authenticated = True
    is_active = True
    pk = 1
    id = None
    cedula_id = '7759999'
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
def carnets(tablas_legadas, monkeypatch):
    monkeypatch.setattr(comun_mod, 'condicion_titular', lambda empleado: 'ACTIVO')
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'V'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='F')
    MotivosEmisionModel.objects.get_or_create(pk=1, defaults={'nombre': 'PRIMERA VEZ'})
    repo = RepoCarnetizacionORM()
    emitidos = []
    for i, cedula in enumerate(CEDULAS):
        EmployeeModel.objects.create(cedulaidentidad=cedula, nombres=f'TITULAR {i}', apellidos='LOTE',
                                     sexoid=sexo, nacionalidad_id=1)
        with transaction.atomic():
            emitidos.append(repo.emitir_carnet(cedula, 1))
    return emitidos


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def _paginas(pdf: bytes) -> int:
    return len(re.findall(rb'/Type\s*/Page[^s]', pdf))


def test_la_cola_lista_solo_los_carnets_sin_imprimir(api, carnets):
    api.post(f'/api/v1/carnetizacion/{carnets[0].id}/impreso/')
    api.post(f'/api/v1/carnetizacion/{carnets[1].id}/revocar/', {'motivo': 'Error'}, format='json')

    cola = api.get('/api/v1/carnetizacion/cola-impresion/').data['data']

    assert [f['carnet_id'] for f in cola] == [carnets[2].id]
    assert cola[0]['nombre'] == 'TITULAR 2 LOTE'


def test_el_lote_genera_el_pdf_y_puede_marcarlos_impresos(api, carnets):
    ids = [c.id for c in carnets[:2]]

    respuesta = api.post('/api/v1/carnetizacion/lote-trabajadores/pdf/',
                         {'carnet_ids': ids, 'marcar_impresos': True}, format='json')

    assert respuesta.status_code == 200
    assert respuesta['Content-Type'] == 'application/pdf'
    assert _paginas(respuesta.content) == 2  # una hoja de anversos y otra de reversos
    assert set(CarnetCicloModel.objects.filter(estado='IMPRESO').values_list('carnet_id', flat=True)) == set(ids)
    cola = api.get('/api/v1/carnetizacion/cola-impresion/').data['data']
    assert [f['carnet_id'] for f in cola] == [carnets[2].id]


def test_sin_marcar_no_cambia_el_estado(api, carnets):
    api.post('/api/v1/carnetizacion/lote-trabajadores/pdf/', {'carnet_ids': [carnets[0].id]}, format='json')
    assert not CarnetCicloModel.objects.exists()


def test_acepta_los_modos_de_impresion_y_rechaza_uno_invalido(api, carnets):
    url = '/api/v1/carnetizacion/lote-trabajadores/pdf/'
    for modo in ('ninguno', 'largo', 'corto'):
        respuesta = api.post(url, {'carnet_ids': [carnets[0].id], 'modo_duplex': modo}, format='json')
        assert respuesta.status_code == 200, (modo, respuesta.content[:300])
        assert respuesta.content.startswith(b'%PDF')

    invalido = api.post(url, {'carnet_ids': [carnets[0].id], 'modo_duplex': 'diagonal'}, format='json')
    assert invalido.status_code == 400


def test_validaciones_del_lote(api, carnets):
    url = '/api/v1/carnetizacion/lote-trabajadores/pdf/'
    assert api.post(url, {'carnet_ids': []}, format='json').status_code == 400
    assert api.post(url, {'carnet_ids': [999999]}, format='json').status_code == 400
    assert api.post(url, {'carnet_ids': list(range(1, 92))}, format='json').status_code == 400
    api.post(f'/api/v1/carnetizacion/{carnets[0].id}/revocar/', {'motivo': 'Extravío'}, format='json')
    assert api.post(url, {'carnet_ids': [carnets[0].id]}, format='json').status_code == 400


class UsuarioSoloLote(Usuario):
    def tiene_permiso(self, codigo):
        return codigo == 'carnetizacion.lote'


def test_k7_con_solo_permiso_de_lote_se_imprime_pero_no_se_marca(carnets):
    api = APIClient()
    api.force_authenticate(user=UsuarioSoloLote())
    url = '/api/v1/carnetizacion/lote-trabajadores/pdf/'

    assert api.post(url, {'carnet_ids': [carnets[0].id]}, format='json').status_code == 200
    marcar = api.post(url, {'carnet_ids': [carnets[0].id], 'marcar_impresos': True}, format='json')
    assert marcar.status_code == 403
    assert not CarnetCicloModel.objects.filter(carnet_id=carnets[0].id).exists()
