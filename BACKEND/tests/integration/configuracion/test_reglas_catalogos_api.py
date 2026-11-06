"""O36: alta, edición y baja de parentescos y tipos de nómina por API."""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    ParentescoModel,
    TipoNominaModel,
)

pytestmark = pytest.mark.django_db

BASE = '/api/v1/configuracion/reglas-catalogos'
LISTA = f'{BASE}/'
PARENTESCOS = f'{BASE}/parentescos/'
NOMINAS = f'{BASE}/nominas/'
PERMISOS = ('configuracion.ver', 'configuracion.editar')


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=1, cedula='V12345678'):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol = type('Rol', (), {'nombre_rol': 'ADMINISTRADOR'})()
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def data(respuesta):
    return respuesta.json()['data']


def test_crear_editar_y_eliminar_parentesco_sin_referencias():
    api = cliente(*PERMISOS)

    creado = api.post(PARENTESCOS, {'descripcion': '  PRIMO   HERMANO '}, format='json')
    assert creado.status_code == 201, creado.content
    parentesco = data(creado)
    assert parentesco['descripcion'] == 'PRIMO HERMANO'

    repetido = api.post(PARENTESCOS, {'descripcion': 'primo hermano'}, format='json')
    assert repetido.status_code == 400
    assert 'Ya existe' in repetido.json()['message']

    editado = api.patch(
        f"{PARENTESCOS}{parentesco['id']}/", {'descripcion': 'PRIMO'}, format='json',
    )
    assert editado.status_code == 200, editado.content
    assert data(editado)['descripcion'] == 'PRIMO'

    eliminado = api.delete(f"{PARENTESCOS}{parentesco['id']}/")
    assert eliminado.status_code == 200, eliminado.content
    assert not ParentescoModel.objects.filter(pk=parentesco['id']).exists()

    listado = api.get(LISTA)
    assert listado.status_code == 200
    assert all(p['descripcion'] != 'PRIMO' for p in data(listado)['parentescos'])


def test_parentesco_reservado_no_se_renombra_ni_se_elimina():
    ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)', aplica_familiar=True)
    api = cliente(*PERMISOS)

    reservado = next(
        p for p in data(api.get(LISTA))['parentescos'] if p['descripcion'] == 'HIJO (A)'
    )

    renombrar = api.patch(
        f"{PARENTESCOS}{reservado['id']}/", {'descripcion': 'HIJO'}, format='json',
    )
    assert renombrar.status_code == 400
    assert 'reservado' in renombrar.json()['message']

    eliminar = api.delete(f"{PARENTESCOS}{reservado['id']}/")
    assert eliminar.status_code == 400
    assert 'reservado' in eliminar.json()['message']


def test_crear_editar_y_eliminar_nomina_sin_referencias():
    api = cliente(*PERMISOS)

    creada = api.post(
        NOMINAS, {'nomina': '  CONTRATO  NUEVO ', 'es_activo': False, 'requiere_codig': True},
        format='json',
    )
    assert creada.status_code == 201, creada.content
    nomina = data(creada)
    assert nomina['nomina'] == 'CONTRATO NUEVO'
    assert nomina['es_activo'] is False
    assert nomina['requiere_codig'] is True

    repetida = api.post(NOMINAS, {'nomina': 'contrato nuevo'}, format='json')
    assert repetida.status_code == 400
    assert 'Ya existe' in repetida.json()['message']

    editada = api.patch(
        f"{NOMINAS}{nomina['id']}/", {'nomina': 'CONTRATO PLANTA'}, format='json',
    )
    assert editada.status_code == 200, editada.content
    assert data(editada)['nomina'] == 'CONTRATO PLANTA'

    eliminada = api.delete(f"{NOMINAS}{nomina['id']}/")
    assert eliminada.status_code == 200, eliminada.content
    assert not TipoNominaModel.objects.filter(pk=nomina['id']).exists()


def test_nomina_reservada_no_se_renombra_ni_se_elimina():
    TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False, requiere_codig=False)
    api = cliente(*PERMISOS)
    reservada = next(
        n for n in data(api.get(LISTA))['nominas'] if n['nomina'] == 'JUBILADO'
    )

    renombrar = api.patch(
        f"{NOMINAS}{reservada['id']}/", {'nomina': 'JUBILADO ESPECIAL'}, format='json',
    )
    assert renombrar.status_code == 400
    assert 'reservada' in renombrar.json()['message']

    eliminar = api.delete(f"{NOMINAS}{reservada['id']}/")
    assert eliminar.status_code == 400
    assert 'reservada' in eliminar.json()['message']


def test_sin_permiso_de_crear_no_puede_dar_de_alta():
    api = cliente('configuracion.ver')

    assert api.post(PARENTESCOS, {'descripcion': 'PRIMO'}, format='json').status_code == 403
    assert api.post(NOMINAS, {'nomina': 'NUEVA'}, format='json').status_code == 403
