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

    # Criterio y respaldo inicial; paleta institucional vigente.
    assert reglas['criterio'] == 'nomina'
    assert reglas['respaldo']['primario'] == '#14284b'
    assert reglas['respaldo']['acento'] == '#c8102e'
    assert reglas['respaldo']['texto'] == '#ffffff'
    assert 'FUNCIONARIO' in reglas['valores']
    assert reglas['valores']['FUNCIONARIO']['primario'] == '#14284b'
    assert reglas['valores']['FUNCIONARIO']['acento'] == '#c8102e'

    # Verificación de textos canónicos en anverso y reverso
    # Adscrito
    lbl_adsc = next(e for e in tpl['reverso'] if e['id'] == 'rev-lbl-adsc')
    assert lbl_adsc['texto'] == 'ADSCRITO A LA UNIDAD DE:'

    # Normas: debe incluir 'lugar' y 'pérdida' con tilde
    normas = next(e for e in tpl['reverso'] if e['id'] == 'rev-normas')
    assert 'lugar visible' in normas['texto']
    assert 'extravío o pérdida' in normas['texto']

    # Adscripción: el campo debe describir la oficina
    oficina = next(e for e in tpl['anverso'] if e['id'] == 'oficina')
    assert 'adscripción' in oficina['nombre']


def test_plantilla_defecto_pasivo_textos_y_reglas():
    """Valida textos y criterio de la plantilla de pasivos."""
    tpl = plantilla_defecto_pasivo()
    normas = next(e for e in tpl['reverso'] if e['id'] == 'rev-normas')
    assert 'pérdida' in normas['texto']
    assert 'Gestión Humana' in normas['texto']


def test_resolver_color_funcionario_azul_marino():
    """Verifica que el titular con tipo Funcionario resuelva al azul/rojo aprobado."""
    tpl = plantilla_defecto_trabajador()
    persona = {'nomina': 'Funcionario'}
    res = resolver_color_carnet(tpl, persona)
    assert res['primario'] == '#14284b'
    assert res['acento'] == '#c8102e'
    assert res['texto'] == '#ffffff'


def test_resolver_color_contratado_y_jubilado():
    """Verifica que diferentes tipos de nómina resuelvan a sus respectivos colores."""
    tpl = plantilla_defecto_trabajador()

    # Contratado
    res_c = resolver_color_carnet(tpl, {'nomina': 'Contratado'})
    assert res_c['primario'] == '#f2b705'
    assert res_c['acento'] == '#14284b'

    # Jubilado
    res_j = resolver_color_carnet(tpl, {'nomina': 'Jubilado'})
    assert res_j['primario'] == '#ffffff'
    assert res_j['acento'] == '#14284b'


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


def _definicion_nomina():
    return {
        'reglas': {
            'criterio': 'nomina',
            'respaldo': {'primario': '#1f3a5f', 'acento': '#1273bd', 'texto': '#ffffff'},
            'valores': {'VISITANTE': {'primario': '#aa0000', 'acento': '#bb0000', 'texto': '#ffffff'}},
        }
    }


def test_credencial_de_visitante_aplica_la_regla_visitante():
    from apps.carnetizacion.domain.services.resolver_color import resolver_color_carnet

    persona = {'nomina': 'VISITANTE', 'tipo_credencial': 'visitante', 'externo': True, 'cargo': 'ACME'}
    assert resolver_color_carnet(_definicion_nomina(), persona)['primario'] == '#aa0000'
    # Con criterio cargo, el tipo de credencial también hace de valor para un externo.
    definicion = _definicion_nomina()
    definicion['reglas']['criterio'] = 'cargo'
    assert resolver_color_carnet(definicion, persona)['primario'] == '#aa0000'


def test_credencial_de_visitante_sin_regla_usa_el_color_de_respaldo():
    from apps.carnetizacion.domain.services.resolver_color import resolver_color_carnet

    persona = {'nomina': 'CONTRATISTA', 'tipo_credencial': 'contratista', 'externo': True}
    assert resolver_color_carnet(_definicion_nomina(), persona)['primario'] == '#1f3a5f'
