"""Esquema de bloques y de campos posicionados, variables y campos propios (dominio puro)."""
import copy

import pytest

from apps.documentos.domain.services.variables_documento import (
    CATALOGO_VARIABLES,
    datos_ejemplo,
    sustituir,
    variables_desconocidas,
)
from apps.documentos.domain.value_objects.esquema_documento import (
    validar_campos_propios,
    validar_definicion,
    validar_metadatos,
    validar_valores_propios,
)
from core.domain.exceptions import ValidationError
from tests.unit.documentos._ayudas import CAMPOS_PROPIOS, definicion_formulario, definicion_overlay

PAGINAS = [{'numero': 1, 'ancho_mm': 190.5, 'alto_mm': 254.0}, {'numero': 2, 'ancho_mm': 190.5, 'alto_mm': 254.0}]


def test_el_catalogo_declara_las_colecciones_futuras_y_el_rif():
    claves = {v['clave'] for v in CATALOGO_VARIABLES}
    assert {'estudios', 'cursos', 'antecedentes', 'idiomas', 'familiares', 'rif'} <= claves
    assert len(claves) == len(CATALOGO_VARIABLES), 'claves repetidas en el catálogo'


def test_formulario_valido_se_normaliza_con_valores_por_defecto():
    definicion, propios = validar_definicion('formulario', definicion_formulario(), CAMPOS_PROPIOS)
    assert definicion['pagina'] == {'tamano': 'carta', 'orientacion': 'vertical'}
    assert [b['tipo'] for b in definicion['bloques']][:2] == ['seccion', 'fila_campos']
    assert definicion['bloques'][1]['alto_mm'] == 12
    assert propios[0]['clave'] == 'sueldo'


def test_variable_desconocida_en_un_parrafo_se_rechaza():
    d = definicion_formulario()
    d['bloques'][4]['texto'] = 'Hola {nombre_inventado}'
    with pytest.raises(ValidationError, match='nombre_inventado') as e:
        validar_definicion('formulario', d, CAMPOS_PROPIOS)
    assert e.value.campo == 'bloques.4.texto'


def test_variable_propia_no_declarada_se_rechaza():
    with pytest.raises(ValidationError, match='Variable desconocida'):
        validar_definicion('formulario', definicion_formulario(), [])  # {propio.sueldo} sin declarar


def test_celda_con_una_coleccion_como_variable_se_rechaza():
    d = definicion_formulario()
    d['bloques'][1]['celdas'][0]['variable'] = 'familiares'
    with pytest.raises(ValidationError, match='desconocida'):
        validar_definicion('formulario', d, CAMPOS_PROPIOS)


@pytest.mark.parametrize('cambio, mensaje', [
    (lambda d: d['bloques'][3].update(coleccion='nada'), 'colección'),
    (lambda d: d['bloques'][3]['columnas'][0].update(variable='idioma'), 'colección'),
    (lambda d: d['bloques'][3].update(filas_minimas=999), 'entre'),
    (lambda d: d['bloques'][2].update(opciones=[]), 'opciones'),
    (lambda d: d['bloques'][0].update(tipo='magia'), 'no permitido'),
    (lambda d: d['bloques'][1].update(celdas=[]), 'celdas'),
    (lambda d: d['bloques'][1].update(id='a'), 'repetido'),
    (lambda d: d['pagina'].update(tamano='a4'), 'no permitido'),
])
def test_esquema_de_bloques_rechaza_lo_invalido(cambio, mensaje):
    d = copy.deepcopy(definicion_formulario())
    cambio(d)
    with pytest.raises(ValidationError, match=mensaje):
        validar_definicion('formulario', d, CAMPOS_PROPIOS)


def test_overlay_valido_y_orden_de_paginas():
    d, _ = validar_definicion('pdf_overlay', definicion_overlay((2, 1)), [], PAGINAS)
    assert [p['origen'] for p in d['paginas']] == [2, 1]
    assert d['paginas'][0]['campos'][0]['alineacion'] == 'izquierda'


def test_overlay_sin_pdf_de_fondo_rechaza_paginas():
    with pytest.raises(ValidationError, match='Suba primero'):
        validar_definicion('pdf_overlay', definicion_overlay(), [], None)


@pytest.mark.parametrize('cambio, mensaje', [
    (lambda d: d['paginas'][0].update(origen=9), 'no existe'),
    (lambda d: d['paginas'][0]['campos'][0].update(texto='{x_raro}'), 'desconocida'),
    (lambda d: d['paginas'][0]['campos'][0].update(x=900), 'entre'),
    (lambda d: d['paginas'][0]['campos'][0].update(x=300), 'fuera de la página'),
    (lambda d: d['paginas'][0]['campos'][0].update(tamano=2), 'entre'),
    (lambda d: d['paginas'][0]['campos'][1]['condicion'].update(variable='familiares'), 'variable'),
    (lambda d: d['paginas'][0]['campos'][1]['condicion'].update(valor=''), 'valor'),
    (lambda d: d['paginas'][0]['campos'][2].update(coleccion='nada'), 'colección'),
    (lambda d: d['paginas'][0]['campos'][0].update(tipo='otro'), 'no permitido'),
])
def test_overlay_rechaza_campos_invalidos(cambio, mensaje):
    d = definicion_overlay()
    cambio(d)
    with pytest.raises(ValidationError, match=mensaje):
        validar_definicion('pdf_overlay', d, [], PAGINAS)


def test_modo_desconocido():
    with pytest.raises(ValidationError, match='Modo'):
        validar_definicion('html', {}, [])


@pytest.mark.parametrize('campos, mensaje', [
    ([{'clave': 'Mala Clave', 'etiqueta': 'x'}], 'minúsculas'),
    ([{'clave': 'a', 'etiqueta': 'x', 'tipo': 'opcion'}], 'opciones'),
    ([{'clave': 'a', 'etiqueta': 'x'}, {'clave': 'a', 'etiqueta': 'y'}], 'repetida'),
    ([{'clave': 'a', 'etiqueta': 'x', 'tipo': 'foto'}], 'no permitido'),
])
def test_campos_propios_invalidos(campos, mensaje):
    with pytest.raises(ValidationError, match=mensaje):
        validar_campos_propios(campos)


def test_valores_propios_obligatoriedad_y_tipos():
    campos = validar_campos_propios([
        {'clave': 'sueldo', 'etiqueta': 'Sueldo', 'obligatorio': True},
        {'clave': 'ruta', 'etiqueta': 'Ruta', 'tipo': 'opcion', 'opciones': ['A', 'B']},
        {'clave': 'acepta', 'etiqueta': 'Acepta', 'tipo': 'si_no'},
    ])
    with pytest.raises(ValidationError, match='obligatorio'):
        validar_valores_propios(campos, {})
    with pytest.raises(ValidationError, match='opciones'):
        validar_valores_propios(campos, {'sueldo': '1', 'ruta': 'Z'})
    ok = validar_valores_propios(campos, {'sueldo': '100', 'ruta': 'A', 'acepta': 'si'})
    assert ok == {'propio.sueldo': '100', 'propio.ruta': 'A', 'propio.acepta': 'SI'}


def test_sustitucion_y_datos_de_ejemplo_incluyen_campos_propios():
    campos = validar_campos_propios(CAMPOS_PROPIOS)
    datos = datos_ejemplo(campos)
    assert datos['propio.sueldo'].startswith('Ejemplo')
    assert sustituir('{nombres} {apellidos} / {propio.sueldo} / {ninguna}', datos).endswith(' / ')
    assert variables_desconocidas('{cedula} {zzz} {propio.sueldo}', campos) == ['zzz']


def test_metadatos():
    m = validar_metadatos('mi plantilla', 'Mi plantilla', 'ventana2', 'ambos', True)
    assert m['codigo'] == 'MI_PLANTILLA' and m['firmante'] == 'ambos'
    with pytest.raises(ValidationError):
        validar_metadatos('x', 'n', 'nunca', 'ambos', False)
