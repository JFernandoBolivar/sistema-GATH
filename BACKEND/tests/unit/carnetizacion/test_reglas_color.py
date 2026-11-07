"""
Tests unitarios para las Reglas de Color y Corrección de Textos (O44 - E7).
"""
import pytest
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_trabajador,
    plantilla_defecto_pasivo,
)
from apps.carnetizacion.domain.services.resolver_color import (
    resolver_color_carnet,
    RESPALDO_DEFECTO,
)


def test_plantilla_defecto_trabajador_reglas_y_textos():
    """Valida la definición canónica de reglas de color y la corrección de textos."""
    tpl = plantilla_defecto_trabajador()
    reglas = tpl['reglas']

    # Criterio y respaldo inicial Funcionario azul marino (#1f3a5f)
    assert reglas['criterio'] == 'nomina'
    assert reglas['respaldo']['primario'] == '#1f3a5f'
    assert reglas['respaldo']['acento'] == '#1273bd'
    assert reglas['respaldo']['texto'] == '#ffffff'
    assert 'FUNCIONARIO' in reglas['valores']
    assert reglas['valores']['FUNCIONARIO']['primario'] == '#1f3a5f'

    # Verificación de textos canónicos en anverso y reverso
    # Adscrito
    lbl_adsc = next(e for e in tpl['reverso'] if e['id'] == 'rev-lbl-adsc')
    assert lbl_adsc['texto'] == 'Adscrito a la unidad de:'

    # Normas: debe incluir 'lugar' y 'pérdida' con tilde
    normas = next(e for e in tpl['reverso'] if e['id'] == 'rev-normas')
    assert 'lugar visible' in normas['texto']
    assert 'extravío o pérdida' in normas['texto']

    # Gestión: debe tener tilde
    oficina = next(e for e in tpl['anverso'] if e['id'] == 'oficina')
    assert 'Gestión' in oficina['nombre']


def test_plantilla_defecto_pasivo_textos_y_reglas():
    """Valida textos y criterio de la plantilla de pasivos."""
    tpl = plantilla_defecto_pasivo()
    normas = next(e for e in tpl['reverso'] if e['id'] == 'rev-normas')
    assert 'pérdida' in normas['texto']
    assert 'Gestión Humana' in normas['texto']


def test_resolver_color_funcionario_azul_marino():
    """Verifica que el titular con tipo Funcionario resuelva a azul marino #1f3a5f."""
    tpl = plantilla_defecto_trabajador()
    persona = {'nomina': 'Funcionario'}
    res = resolver_color_carnet(tpl, persona)
    assert res['primario'] == '#1f3a5f'
    assert res['acento'] == '#1273bd'
    assert res['texto'] == '#ffffff'


def test_resolver_color_contratado_y_jubilado():
    """Verifica que diferentes tipos de nómina resuelvan a sus respectivos colores."""
    tpl = plantilla_defecto_trabajador()

    # Contratado
    res_c = resolver_color_carnet(tpl, {'nomina': 'Contratado'})
    assert res_c['primario'] == '#c79a12'
    assert res_c['acento'] == '#16264a'

    # Jubilado
    res_j = resolver_color_carnet(tpl, {'nomina': 'Jubilado'})
    assert res_j['primario'] == '#1f4e38'
    assert res_j['acento'] == '#2d7a58'


def test_resolver_color_desconocido_cae_a_respaldo():
    """Si el titular tiene una nómina desconocida, cae al valor de respaldo."""
    tpl = plantilla_defecto_trabajador()
    res = resolver_color_carnet(tpl, {'nomina': 'EXTRATERRESTRE'})
    assert res['primario'] == tpl['reglas']['respaldo']['primario']
    assert res['acento'] == tpl['reglas']['respaldo']['acento']


def test_resolver_color_criterio_unico_ignora_persona():
    """Cuando el criterio es 'unico', siempre devuelve el respaldo."""
    definicion = {
        'reglas': {
            'criterio': 'unico',
            'respaldo': {'primario': '#003366', 'acento': '#ffcc00', 'texto': '#ffffff'},
            'valores': {'GERENTE': {'primario': '#ff0000', 'acento': '#000000', 'texto': '#ffffff'}},
        }
    }
    res = resolver_color_carnet(definicion, {'nomina': 'GERENTE'})
    assert res['primario'] == '#003366'
    assert res['acento'] == '#ffcc00'


def test_resolver_color_criterio_cargo_u_oficina():
    """Verifica resolución dinámica por cargo u oficina."""
    definicion_cargo = {
        'reglas': {
            'criterio': 'cargo',
            'respaldo': {'primario': '#1f3a5f', 'acento': '#1273bd', 'texto': '#ffffff'},
            'valores': {
                'DIRECTOR': {'primario': '#4a154b', 'acento': '#ecb22e', 'texto': '#ffffff'},
                'ANALISTA': {'primario': '#1f3a5f', 'acento': '#1273bd', 'texto': '#ffffff'},
            },
        }
    }
    res_dir = resolver_color_carnet(definicion_cargo, {'cargo': 'Director'})
    assert res_dir['primario'] == '#4a154b'

    definicion_oficina = {
        'reglas': {
            'criterio': 'oficina',
            'respaldo': {'primario': '#1f3a5f', 'acento': '#1273bd', 'texto': '#ffffff'},
            'valores': {
                'OFICINA_DE_GESTION_HUMANA': {'primario': '#1e3a8a', 'acento': '#3b82f6', 'texto': '#ffffff'},
            },
        }
    }
    res_ofi = resolver_color_carnet(definicion_oficina, {'oficina': 'Oficina de Gestión Humana'})
    assert res_ofi['primario'] == '#1e3a8a'
