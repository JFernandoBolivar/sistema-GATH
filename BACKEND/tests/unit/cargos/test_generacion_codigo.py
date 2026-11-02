"""
Tests unitarios de la gestión de código de asignación de trabajo (gap #5).
Puros, sin BD ni Django.
"""
import pytest

from apps.cargos.domain.services.generacion_codigo import (
    generar_codigo_normal,
    generar_prefijo_nomina,
    siguiente_codigo_especial,
)


def test_generar_prefijo_nomina_toma_iniciales_ignorando_stop_words():
    assert generar_prefijo_nomina('COMISION DE SERVICIO') == 'CS_'
    assert generar_prefijo_nomina('HONORARIOS PROFESIONALES') == 'HP_'


def test_generar_prefijo_nomina_vacio_lanza_error():
    with pytest.raises(ValueError):
        generar_prefijo_nomina('DE LA EL')


def test_siguiente_codigo_especial_sin_previos_arranca_en_1():
    assert siguiente_codigo_especial('CS_', None) == 'CS_0001'


def test_siguiente_codigo_especial_incrementa_el_correlativo():
    assert siguiente_codigo_especial('CS_', 'CS_0001') == 'CS_0002'
    assert siguiente_codigo_especial('CS_', 'CS_0009') == 'CS_0010'


def test_generar_codigo_normal_usa_ubicacion_mas_especifica():
    codigo = generar_codigo_normal(
        codigo_coordinacion='040102',
        codigo_direccion_linea='0401',
        codigo_direccion_general='04',
        codigo_dependencia='01',
        nombre_cargo='COORDINADOR DE TALENTO HUMANO',
        sufijos_ya_usados_en_ubicacion=set(),
    )
    assert codigo == '04010203'  # COORDINADOR -> sufijo base 03


def test_generar_codigo_normal_director_general_usa_sufijo_01():
    # `Codigo` corto se rellena con ceros a la izquierda hasta 6 dígitos
    # (mismo comportamiento que el legado: `Codigo[:6].zfill(6)`).
    codigo = generar_codigo_normal(
        codigo_coordinacion=None,
        codigo_direccion_linea=None,
        codigo_direccion_general='04',
        codigo_dependencia='01',
        nombre_cargo='DIRECTOR GENERAL',
        sufijos_ya_usados_en_ubicacion=set(),
    )
    assert codigo == '00000401'


def test_generar_codigo_normal_incrementa_si_el_sufijo_ya_esta_usado():
    codigo = generar_codigo_normal(
        codigo_coordinacion='040102',
        codigo_direccion_linea=None,
        codigo_direccion_general=None,
        codigo_dependencia=None,
        nombre_cargo='ANALISTA',  # sin palabra clave -> sufijo base 04
        sufijos_ya_usados_en_ubicacion={4},
    )
    assert codigo == '04010205'


def test_generar_codigo_normal_sin_ubicacion_lanza_error():
    with pytest.raises(ValueError):
        generar_codigo_normal(None, None, None, None, 'ANALISTA', set())
