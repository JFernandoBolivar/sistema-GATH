"""N-1: catálogo de procesos y variables disponibles por proceso (dominio puro)."""
import copy

import pytest

from apps.documentos.domain.services.catalogo_procesos import (
    CATALOGO_PROCESOS,
    GRUPO_BAJO_DEMANDA,
    GRUPO_INGRESO,
    GRUPO_MOVIMIENTO,
    GRUPO_PUNTO_CUENTA,
    PROCESO_BAJO_DEMANDA,
    etiqueta_proceso,
    obtener_proceso,
    procesos_de_grupo,
    validar_proceso,
)
from apps.documentos.domain.services.variables_documento import (
    CATALOGO_VARIABLES,
    catalogo_para_interfaz,
    datos_ejemplo,
    variables_desconocidas,
    variables_disponibles,
)
from apps.documentos.domain.value_objects.esquema_documento import validar_definicion, validar_metadatos
from apps.movimientos.domain.value_objects.proceso_movimiento import proceso_de_movimiento
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import PROCESOS_POR_DEFECTO
from core.domain.exceptions import ValidationError
from tests.unit.documentos._ayudas import definicion_formulario

PC = 'punto_cuenta:cambio_oficina'


def _claves(proceso):
    return {v['clave'] for v in variables_disponibles(proceso)}


def test_el_catalogo_trae_todos_los_procesos_pedidos():
    codigos = [p.codigo for p in CATALOGO_PROCESOS]
    assert codigos == [
        'ingreso_ventana2', 'ingreso_contratacion',
        'punto_cuenta:ingreso_postulacion', 'punto_cuenta:cambio_oficina', 'punto_cuenta:cambio_nivel',
        'punto_cuenta:cambio_division', 'punto_cuenta:cambio_cargo_misma_oficina',
        'punto_cuenta:egreso_activo', 'punto_cuenta:pase_a_pasivo',
        'punto_cuenta:encargaduria_prestamo', 'punto_cuenta:cambio_estatus',
        'movimiento:ingreso', 'movimiento:traslado', 'movimiento:egreso', 'movimiento:cambio_de_estatus',
        'bajo_demanda',
    ]
    assert len(codigos) == len(set(codigos))
    assert {p.codigo for p in procesos_de_grupo(GRUPO_PUNTO_CUENTA)} == {f'punto_cuenta:{p}' for p in PROCESOS_POR_DEFECTO}
    assert {p.codigo for p in procesos_de_grupo(GRUPO_MOVIMIENTO)} == {
        'movimiento:ingreso', 'movimiento:traslado', 'movimiento:egreso', 'movimiento:cambio_de_estatus'}
    assert {p.grupo for p in CATALOGO_PROCESOS} == {GRUPO_INGRESO, GRUPO_PUNTO_CUENTA, GRUPO_MOVIMIENTO, GRUPO_BAJO_DEMANDA}
    assert all(p.etiqueta and p.descripcion for p in CATALOGO_PROCESOS)


def test_los_tipos_de_movimiento_del_historial_tienen_su_proceso_en_el_catalogo():
    for tipo in ('INGRESO', 'TRASLADO', 'EGRESO', 'CAMBIO DE ESTATUS'):
        assert obtener_proceso(proceso_de_movimiento(tipo)) is not None, tipo
    assert proceso_de_movimiento('OTRO') is None


def test_validar_proceso_y_etiquetas():
    assert validar_proceso(None, defecto=PROCESO_BAJO_DEMANDA) == 'bajo_demanda'
    assert validar_proceso(PC) == PC
    with pytest.raises(ValidationError):
        validar_proceso('ventana2')
    assert etiqueta_proceso(PC) == 'Punto de Cuenta: cambio de oficina'
    assert obtener_proceso(PC).etiqueta_corta == 'cambio de oficina'


def test_cada_proceso_declara_solo_grupos_que_existen_en_el_catalogo_de_variables():
    grupos = {v['grupo'] for v in CATALOGO_VARIABLES}
    for p in CATALOGO_PROCESOS:
        assert set(p.grupos_variables) <= grupos, p.codigo
        assert variables_disponibles(p.codigo), p.codigo


def test_el_punto_de_cuenta_y_los_movimientos_tienen_las_variables_del_movimiento():
    esperadas = {
        'origen', 'destino', 'motivo', 'fecha', 'numero', 'firmantes', 'nombre_completo', 'cedula', 'cargo',
        'cargo_destino', 'nivel', 'tipo_personal', 'fecha_efectiva', 'anios_servicio', 'presentado_a',
        'cargo_presentado_a', 'presentado_por', 'cargo_presentado_por', 'unidad', 'referencia_constancia', 'emitido_por',
    }
    for p in procesos_de_grupo(GRUPO_PUNTO_CUENTA) + procesos_de_grupo(GRUPO_MOVIMIENTO):
        assert esperadas <= _claves(p.codigo), p.codigo
        assert not {'talla_camisa', 'familiares', 'grupo_sanguineo'} & _claves(p.codigo), p.codigo


def test_el_ingreso_y_lo_bajo_demanda_no_tienen_las_variables_del_movimiento():
    for codigo in ('ingreso_ventana2', 'ingreso_contratacion', 'bajo_demanda'):
        assert not {'origen', 'destino', 'motivo', 'firmantes'} & _claves(codigo), codigo
    assert {'talla_camisa', 'familiares', 'grupo_sanguineo'} <= _claves('ingreso_ventana2')
    assert 'familiares' in _claves('bajo_demanda') and 'talla_camisa' not in _claves('bajo_demanda')


def test_sin_proceso_se_conserva_el_catalogo_completo():
    assert _claves(None) == {v['clave'] for v in CATALOGO_VARIABLES}
    assert {v['clave'] for v in catalogo_para_interfaz()} == _claves(None)
    assert {v['clave'] for v in catalogo_para_interfaz(proceso=PC)} == _claves(PC)


def test_el_selector_de_variables_agrega_los_campos_propios_al_proceso():
    propios = [{'clave': 'sueldo', 'etiqueta': 'Sueldo', 'tipo': 'texto'}]
    assert 'propio.sueldo' in {v['clave'] for v in catalogo_para_interfaz(propios, 'bajo_demanda')}


def test_las_desconocidas_dependen_del_proceso():
    assert variables_desconocidas('{origen}', [], 'ingreso_ventana2') == ['origen']
    assert variables_desconocidas('{origen} {talla_camisa}', [], PC) == ['talla_camisa']
    assert variables_desconocidas('{propio.x}', [{'clave': 'x'}], PC) == []


def _parrafo(texto):
    d = copy.deepcopy(definicion_formulario())
    d['bloques'] = [{'id': 'p', 'tipo': 'parrafo', 'texto': texto, 'alineacion': 'justificado'}]
    return d


def test_la_validacion_rechaza_variables_que_no_corresponden_al_proceso():
    with pytest.raises(ValidationError, match='no permitida por el proceso'):
        validar_definicion('formulario', _parrafo('Desde {origen}'), [], None, 'ingreso_ventana2')
    with pytest.raises(ValidationError, match='no permitida por el proceso'):
        validar_definicion('formulario', _parrafo('Talla {talla_camisa}'), [], None, PC)
    validar_definicion('formulario', _parrafo('Desde {origen} hacia {destino}, {nombre_completo}'), [], None, PC)


def test_la_validacion_de_celdas_casillas_condiciones_y_colecciones_tambien_filtra():
    d = copy.deepcopy(definicion_formulario())  # trae una tabla de «familiares»
    with pytest.raises(ValidationError, match='permitida por el proceso'):
        validar_definicion('formulario', d, [{'clave': 'sueldo', 'etiqueta': 'S', 'tipo': 'texto', 'obligatorio': True}],
                           None, PC)
    fila = {'id': 'f', 'tipo': 'fila_campos', 'celdas': [{'etiqueta': 'Cargo', 'variable': 'cargo_destino', 'ancho': 1}]}
    validar_definicion('formulario', {**d, 'bloques': [fila]}, [], None, PC)
    fila['celdas'][0]['variable'] = 'talla_camisa'
    with pytest.raises(ValidationError, match='no permitida por el proceso'):
        validar_definicion('formulario', {**d, 'bloques': [fila]}, [], None, PC)
    casillas = {'id': 'c', 'tipo': 'casillas', 'etiqueta': 'x', 'variable': 'origen', 'columnas': 1,
                'opciones': [{'valor': 'a', 'etiqueta': 'A'}]}
    with pytest.raises(ValidationError):
        validar_definicion('formulario', {**d, 'bloques': [casillas]}, [], None, 'ingreso_ventana2')


def test_overlay_tambien_valida_el_proceso():
    paginas = [{'numero': 1, 'ancho_mm': 190.5, 'alto_mm': 254.0}]
    texto = {'id': 't', 'tipo': 'texto', 'texto': '{origen}', 'x': 20, 'y': 30, 'w': 100, 'h': 7, 'tamano': 10}
    definicion = {'paginas': [{'origen': 1, 'campos': [texto]}]}
    validar_definicion('pdf_overlay', definicion, [], paginas, PC)
    with pytest.raises(ValidationError, match='no permitida por el proceso'):
        validar_definicion('pdf_overlay', definicion, [], paginas, 'ingreso_contratacion')


def test_metadatos_exigen_un_proceso_del_catalogo_y_por_defecto_es_bajo_demanda():
    assert validar_metadatos('x', 'X', None, 'conatel', False)['proceso'] == 'bajo_demanda'
    assert validar_metadatos('x', 'X', PC, 'conatel', False)['proceso'] == PC
    with pytest.raises(ValidationError):
        validar_metadatos('x', 'X', 'otro', 'conatel', False)


def test_los_datos_de_ejemplo_solo_traen_lo_del_proceso():
    assert 'origen' in datos_ejemplo(None, PC) and 'talla_camisa' not in datos_ejemplo(None, PC)
    assert 'origen' not in datos_ejemplo(None, 'ingreso_ventana2')
