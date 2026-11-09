"""Motivos por categoría: listado por operación, alta («Otros…») y validación al ejecutar."""
import importlib
from types import SimpleNamespace

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import CategoriaMovimientoModel, TipoMovimientoModel
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    obtener_motivo_de_operacion,
    obtener_motivo_de_sistema,
)
from core.domain.categorias_motivo import MOTIVO_SISTEMA_JUBILACION, Operacion
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


# ---------------------------------------------------------------------------
# D13: motivos del sistema en PASE A PASIVO y migración de duplicados
# ---------------------------------------------------------------------------

def _migracion():
    return importlib.import_module('core.migrations.0012_motivos_pase_a_pasivo')


def _aplicar_migracion():
    _migracion().ajustar(None, SimpleNamespace(connection=connection))


@pytest.fixture
def categorias_pase():
    return {
        'egreso': CategoriaMovimientoModel.objects.create(categoria='EGRESO'),
        'ingreso': CategoriaMovimientoModel.objects.create(categoria='INGRESO'),
        'pase': CategoriaMovimientoModel.objects.create(categoria='PASE A PASIVO'),
    }


def test_migracion_mueve_el_original_y_reasigna_las_fk_del_duplicado(categorias_pase):
    original = TipoMovimientoModel.objects.create(
        movimiento='JUBILACION DE DERECHO', categoria=categorias_pase['egreso'],
    )
    duplicado = TipoMovimientoModel.objects.create(
        movimiento='JUBILACION DE DERECHO', categoria=categorias_pase['ingreso'],
    )
    with connection.cursor() as c:
        c.execute(
            'CREATE TABLE tmp_ref_motivo '
            '(id serial primary key, motivo_id int REFERENCES "Tipo_movimiento"(id))'
        )
        c.execute('INSERT INTO tmp_ref_motivo (motivo_id) VALUES (%s)', [duplicado.pk])

    _aplicar_migracion()

    original.refresh_from_db()
    assert original.categoria_id == categorias_pase['pase'].pk
    assert not TipoMovimientoModel.objects.filter(pk=duplicado.pk).exists()
    with connection.cursor() as c:
        c.execute('SELECT motivo_id FROM tmp_ref_motivo')
        assert c.fetchone()[0] == original.pk
        c.execute('DROP TABLE tmp_ref_motivo')


def test_migracion_mueve_el_de_ingreso_si_no_hay_original_en_egreso(categorias_pase):
    solo_ingreso = TipoMovimientoModel.objects.create(
        movimiento='PENSION DE INVALIDEZ', categoria=categorias_pase['ingreso'],
    )

    _aplicar_migracion()

    solo_ingreso.refresh_from_db()
    assert solo_ingreso.categoria_id == categorias_pase['pase'].pk
    assert TipoMovimientoModel.objects.filter(pk=solo_ingreso.pk).exists()


def test_migracion_es_idempotente(categorias_pase):
    TipoMovimientoModel.objects.create(
        movimiento='PENSION POR SOBREVIVIENTE', categoria=categorias_pase['ingreso'],
    )

    _aplicar_migracion()
    _aplicar_migracion()

    filas = TipoMovimientoModel.objects.filter(movimiento='PENSION POR SOBREVIVIENTE')
    assert filas.count() == 1
    assert filas.first().categoria_id == categorias_pase['pase'].pk


def test_motivo_de_sistema_se_busca_en_pase_a_pasivo(categorias_pase):
    en_ingreso = TipoMovimientoModel.objects.create(
        movimiento=MOTIVO_SISTEMA_JUBILACION, categoria=categorias_pase['ingreso'],
    )
    en_pase = TipoMovimientoModel.objects.create(
        movimiento=MOTIVO_SISTEMA_JUBILACION, categoria=categorias_pase['pase'],
    )

    encontrado = obtener_motivo_de_sistema(MOTIVO_SISTEMA_JUBILACION)

    assert encontrado.pk == en_pase.pk
    assert encontrado.pk != en_ingreso.pk
