"""Motivos por categoría: listado por operación, alta («Otros…») y validación al ejecutar."""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import CategoriaMovimientoModel, TipoMovimientoModel
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import obtener_motivo_de_operacion
from core.domain.categorias_motivo import Operacion
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db

URL = '/api/v1/catalogos/tipos-movimiento/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def motivos():
    egreso = CategoriaMovimientoModel.objects.create(categoria='EGRESO')
    egreso_pasivo = CategoriaMovimientoModel.objects.create(categoria='EGRESO PASIVO')
    TipoMovimientoModel.objects.create(movimiento='RENUNCIA', categoria=egreso)
    TipoMovimientoModel.objects.create(movimiento='FALLECIMIENTO', categoria=egreso_pasivo)
    return {'egreso': egreso, 'egreso_pasivo': egreso_pasivo}


def test_listado_por_operacion_filtra_por_categoria(motivos):
    r = _cliente('catalogos.ver').get(URL, {'operacion': 'egreso_pasivo'})
    assert [m['nombre'] for m in r.json()['data']] == ['FALLECIMIENTO']
    r = _cliente('catalogos.ver').get(URL, {'operacion': 'egreso_activo'})
    assert [m['nombre'] for m in r.json()['data']] == ['RENUNCIA']


def test_crear_motivo_en_la_categoria_de_la_operacion(motivos):
    r = _cliente('catalogos.crear').post(URL, {'movimiento': 'fin de contrato', 'operacion': 'egreso_activo'}, format='json')
    assert r.status_code == 201, r.content
    nuevo = TipoMovimientoModel.objects.get(movimiento='FIN DE CONTRATO')
    assert nuevo.categoria_id == motivos['egreso'].pk


def test_crear_motivo_requiere_permiso(motivos):
    r = _cliente('catalogos.ver').post(URL, {'movimiento': 'ALGO NUEVO', 'operacion': 'egreso_activo'}, format='json')
    assert r.status_code == 403


def test_crear_motivo_duplicado_sin_distinguir_mayusculas_marca_el_campo(motivos):
    r = _cliente('catalogos.crear').post(URL, {'movimiento': 'renuncia', 'operacion': 'egreso_activo'}, format='json')
    assert r.status_code == 400
    assert 'movimiento' in r.json()['data']['errores']
    # En otra categoría el mismo nombre sí se permite.
    r = _cliente('catalogos.crear').post(URL, {'movimiento': 'renuncia', 'operacion': 'egreso_pasivo'}, format='json')
    assert r.status_code == 201


@pytest.mark.parametrize('texto', ['ab', 'x' * 101])
def test_crear_motivo_longitud_invalida(motivos, texto):
    r = _cliente('catalogos.crear').post(URL, {'movimiento': texto, 'operacion': 'egreso_activo'}, format='json')
    assert r.status_code == 400
    assert 'movimiento' in r.json()['data']['errores']


def test_obtener_motivo_valida_la_categoria_y_marca_el_campo(motivos):
    fallecimiento = TipoMovimientoModel.objects.get(movimiento='FALLECIMIENTO')
    assert obtener_motivo_de_operacion(fallecimiento.pk, Operacion.EGRESO_PASIVO).pk == fallecimiento.pk
    with pytest.raises(ValidationError) as exc:
        obtener_motivo_de_operacion(fallecimiento.pk, Operacion.CAMBIAR_CARGO)
    assert exc.value.campo == 'motivo_id'
