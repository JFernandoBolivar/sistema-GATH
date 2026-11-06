"""Detección pura de correos repetidos entre institucional y alternativo."""
from apps.identidad.domain.services.colisiones_correo import (
    agrupar_por_correo,
    cedulas_en_conflicto,
    detectar_colisiones,
)


def test_agrupa_normalizando_y_omitiendo_vacios():
    agrupado = agrupar_por_correo([('1', ' A@x.test '), ('2', 'a@x.test'), ('3', ''), ('4', None)])
    assert agrupado == {'a@x.test': {'1', '2'}}


def test_detecta_repetido_entre_trabajadores_y_cruce_institucional_alternativo():
    inst = {'a@x.test': {'1', '2'}, 'b@x.test': {'3'}, 'c@x.test': {'5'}}
    alt = {'b@x.test': {'4'}, 'd@x.test': {'6'}}
    colisiones = detectar_colisiones(inst, alt)
    assert [c.correo for c in colisiones] == ['a@x.test', 'b@x.test']
    assert colisiones[1].cedulas_institucional == {'3'}
    assert colisiones[1].cedulas_alternativo == {'4'}
    assert colisiones[0].cedulas == {'1', '2'}


def test_mismo_trabajador_no_colisiona_consigo_mismo():
    assert detectar_colisiones({'a@x.test': {'1'}}, {}) == []
    assert cedulas_en_conflicto('A@x.test', '1', {'a@x.test': {'1'}}, {}) == set()
    assert cedulas_en_conflicto('a@x.test', '1', {'a@x.test': {'1'}}, {'a@x.test': {'2'}}) == {'2'}
