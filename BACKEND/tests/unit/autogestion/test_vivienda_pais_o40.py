"""O40: la vivienda de la autogestión se valida según el país de residencia."""
import pytest

from apps.autogestion.domain.services.validacion_cambios import (
    validar_registro_nuevo,
    validar_valor,
    validar_vivienda_condicional,
)
from core.domain.exceptions import ValidationError

VENEZUELA = {
    'pais_id': 1,
    'direccion_exacta': 'Calle 5, casa 3, sector centro',
    'condicion_vivienda_id': 9,
    'estado_id': 2,
    'municipio_id': 3,
    'parroquia_id': 4,
    'codigo_postal_id': 5,
}
EXTERIOR = {
    'pais_id': 7,
    'ciudad_region': '  Santiago de Chile  ',
    'direccion_exacta': 'Av. Providencia 1234, departamento 5',
    'condicion_vivienda_id': 9,
}


def test_venezuela_exige_la_ubicacion_completa():
    limpios = validar_registro_nuevo('vivienda', 'datos_vivienda', VENEZUELA)
    assert limpios['estado_id'] == 2
    with pytest.raises(ValidationError):
        validar_registro_nuevo(
            'vivienda', 'datos_vivienda', {**VENEZUELA, 'municipio_id': None},
        )


def test_otro_pais_exige_ciudad_y_permite_ubicacion_vacia():
    limpios = validar_registro_nuevo(
        'vivienda', 'datos_vivienda', EXTERIOR, es_venezuela=False,
    )
    assert limpios['ciudad_region'] == 'SANTIAGO DE CHILE'
    assert limpios.get('estado_id') is None

    with pytest.raises(ValidationError):
        validar_registro_nuevo(
            'vivienda',
            'datos_vivienda',
            {**EXTERIOR, 'ciudad_region': '   '},
            es_venezuela=False,
        )


def test_el_estado_final_de_la_vivienda_se_valida_tras_cambiar_de_pais():
    validar_vivienda_condicional(EXTERIOR, es_venezuela=False)
    with pytest.raises(ValidationError):
        validar_vivienda_condicional(
            {**EXTERIOR, 'ciudad_region': ''}, es_venezuela=False,
        )
    with pytest.raises(ValidationError):
        validar_vivienda_condicional(
            {k: v for k, v in VENEZUELA.items() if k != 'parroquia_id'},
            es_venezuela=True,
        )


def test_ciudad_region_se_recorta_y_limita():
    assert validar_valor('ciudad_region', '  Santiago   de   chile  ') == 'SANTIAGO DE CHILE'
    # P11: el valor se trunca al límite de 120, no se rechaza.
    recortada = validar_valor('ciudad_region', 'x' * 121)
    assert recortada == 'X' * 120
    assert len(recortada) == 120


def test_error_vivienda_condicional_usa_etiquetas_legibles_sin_id():
    """PRUEBAS-USUARIO P12a: Los nombres de campos faltantes no deben llevar _id."""
    with pytest.raises(ValidationError) as exc:
        validar_vivienda_condicional(
            {'pais_id': 1, 'direccion_exacta': 'Calle 5', 'condicion_vivienda_id': 1},
            es_venezuela=True,
        )
    msg = str(exc.value)
    assert 'codigo_postal_id' not in msg
    assert 'estado_id' not in msg
    assert 'municipio_id' not in msg
    assert 'parroquia_id' not in msg
    assert 'Código postal' in msg
    assert 'Estado' in msg
    assert 'Municipio' in msg
    assert 'Parroquia' in msg



def test_otro_pais_rechaza_estado_municipio_y_parroquia():
    """Un país distinto de Venezuela no acepta geografía venezolana (mensaje claro)."""
    with pytest.raises(ValidationError) as exc:
        validar_vivienda_condicional(
            {**EXTERIOR, 'estado_id': 2, 'municipio_id': 3, 'parroquia_id': 4},
            es_venezuela=False,
        )
    msg = str(exc.value)
    assert 'fuera de Venezuela' in msg
    assert 'estado' in msg and 'municipio' in msg and 'parroquia' in msg
    with pytest.raises(ValidationError):
        validar_registro_nuevo(
            'vivienda', 'datos_vivienda', {**EXTERIOR, 'estado_id': 2}, es_venezuela=False,
        )
