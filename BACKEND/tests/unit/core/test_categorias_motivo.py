"""Mapa operación -> categoría de motivo (puro, sin BD)."""
import pytest

from core.domain.categorias_motivo import (
    CATEGORIA_POR_OPERACION,
    LONGITUD_MAX_CATEGORIA,
    CategoriaMotivo,
    Operacion,
    categoria_conocida,
    categoria_de,
    normalizar_nombre_motivo,
    operacion_de,
    validar_motivo_de_operacion,
)
from core.domain.exceptions import ValidationError


def test_toda_operacion_tiene_categoria():
    assert set(CATEGORIA_POR_OPERACION) == set(Operacion)


def test_nombres_de_categoria_caben_en_la_columna():
    assert all(len(c.value) <= LONGITUD_MAX_CATEGORIA for c in CategoriaMotivo)


@pytest.mark.parametrize('operacion, esperada', [
    ('egreso_activo', 'EGRESO'),
    ('egreso_pasivo', 'EGRESO PASIVO'),
    ('cambiar_cargo', 'TRASLADO'),
    ('prestamo_cargo', 'ENCARGADURIA'),
    ('pase_a_pasivo', 'PASE A PASIVO'),
    ('ASIGNAR_CARGO', 'INGRESO'),
])
def test_categoria_de_operacion(operacion, esperada):
    assert categoria_de(operacion).value == esperada


def test_operacion_desconocida_marca_el_campo():
    with pytest.raises(ValidationError) as exc:
        operacion_de('inventada')
    assert exc.value.campo == 'operacion'


def test_categoria_conocida_acepta_minusculas_y_rechaza_otras():
    assert categoria_conocida(' egreso pasivo ') is CategoriaMotivo.EGRESO_PASIVO
    with pytest.raises(ValidationError) as exc:
        categoria_conocida('CUALQUIERA')
    assert exc.value.campo == 'categoria'


def test_motivo_de_otra_categoria_se_rechaza_con_campo():
    with pytest.raises(ValidationError) as exc:
        validar_motivo_de_operacion('EGRESO', Operacion.EGRESO_PASIVO)
    assert exc.value.campo == 'motivo_id'
    with pytest.raises(ValidationError):
        validar_motivo_de_operacion(None, Operacion.CAMBIAR_CARGO, campo='motivo_movimiento_id')


def test_motivo_de_la_categoria_correcta_pasa():
    validar_motivo_de_operacion('egreso pasivo', Operacion.EGRESO_PASIVO)


@pytest.mark.parametrize('texto', ['', 'ab', '  a ', 'x' * 101, 'MOTIVO <b>'])
def test_nombre_invalido(texto):
    with pytest.raises(ValidationError) as exc:
        normalizar_nombre_motivo(texto)
    assert exc.value.campo == 'movimiento'


def test_nombre_valido_se_normaliza():
    assert normalizar_nombre_motivo('  fin   de  contrato ') == 'FIN DE CONTRATO'
    assert len(normalizar_nombre_motivo('x' * 100)) == 100
