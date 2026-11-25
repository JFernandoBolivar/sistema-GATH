"""Documentos automáticos de movimientos: mapeo, no-op, snapshot y generación."""

import pytest

from apps.movimientos.application.use_cases.generar_documentos_movimiento import (
    generar_documentos_movimiento,
)
from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.domain.ports.generador_documentos_movimiento import (
    DocumentoGeneradoMovimiento,
    PlantillaDocumentoMovimiento,
)
from apps.movimientos.domain.value_objects.proceso_movimiento import proceso_de_movimiento
from apps.movimientos.presentation.serializers.movimientos_serializers import MovimientoCargoSerializer


def _movimiento(tipo='TRASLADO'):
    return MovimientoCargo(
        id=23,
        empleado_cedula='V12345678',
        codigo_puesto='COD-23',
        tipo_movimiento=tipo,
        motivo_id=3,
        motivo_nombre='TRASLADO POR NECESIDAD',
        denominacion_nombre='ANALISTA',
        especifica_nombre='ANALISTA I',
        grado_nombre=None,
        tipo_nomina_nombre='FIJO',
        estatus_nombre='ACTIVO',
        tipo_personal_nombre='ACTIVO',
        dependencia_nombre='GESTION HUMANA',
        direccion_general_nombre='OFICINA DE GESTION HUMANA',
        direccion_linea_nombre=None,
        coordinacion_nombre=None,
        fecha_movimiento='2026-11-25T10:00:00-04:00',
        ejecutado_por_id=7,
        ejecutado_por_nombre='Analista RRHH',
    )


class GeneradorFalso:
    def __init__(self, plantillas):
        self.plantillas = plantillas
        self.llamadas = []

    def plantillas_activas(self, proceso):
        self.llamadas.append(('plantillas', proceso))
        return self.plantillas

    def generar_plantilla(self, plantilla_id, **kwargs):
        self.llamadas.append(('generar', plantilla_id, kwargs))
        return DocumentoGeneradoMovimiento(
            id=f'doc-{plantilla_id}',
            plantilla_id=plantilla_id,
            sujeto_tipo=kwargs['sujeto_tipo'],
            sujeto_id=kwargs['sujeto_id'],
            datos_snapshot=kwargs['datos'],
            pdf_sha256=f'sha-{plantilla_id}',
            version_numero=1,
        )


class ProveedorFalso:
    def __init__(self, datos=None, error=None):
        self.datos = datos or {
            'nombres': 'ANA',
            'apellidos': 'PEREZ',
            'cedula_numero': '12345678',
            'correo': 'ana@example.com',
            'origen': 'OFICINA ANTERIOR - NIVEL ANTERIOR',
        }
        self.error = error
        self.llamadas = []

    def datos_de(self, cedula, *, movimiento, evento=None):
        self.llamadas.append((cedula, movimiento.id, evento))
        if self.error:
            raise self.error
        return dict(self.datos)


@pytest.mark.parametrize(
    'tipo, proceso',
    [
        ('INGRESO', 'movimiento:ingreso'),
        ('TRASLADO', 'movimiento:traslado'),
        ('EGRESO', 'movimiento:egreso'),
        ('CAMBIO DE ESTATUS', 'movimiento:cambio_de_estatus'),
        ('cambio_de_estatus', 'movimiento:cambio_de_estatus'),
        ('  Egreso  ', 'movimiento:egreso'),
    ],
)
def test_tipos_historicos_mapean_a_proceso_documental(tipo, proceso):
    assert proceso_de_movimiento(tipo) == proceso


def test_tipo_desconocido_no_mapea_proceso():
    assert proceso_de_movimiento('ENCARGADURIA') is None
    assert proceso_de_movimiento(None) is None


def test_sin_plantillas_es_no_op_y_no_consulta_trabajador():
    generador = GeneradorFalso([])
    proveedor = ProveedorFalso(error=AssertionError('no debe consultarse'))

    documentos = generar_documentos_movimiento(
        generador, proveedor, _movimiento(), proceso='movimiento:traslado',
    )

    assert documentos == []
    assert proveedor.llamadas == []
    assert generador.llamadas == [('plantillas', 'movimiento:traslado')]


def test_genera_un_documento_por_plantilla_con_snapshot_y_trabajador_real():
    plantillas = [
        PlantillaDocumentoMovimiento('p-1', 'TRASLADO', 'Traslado'),
        PlantillaDocumentoMovimiento('p-2', 'TRASLADO2', 'Traslado adicional'),
    ]
    generador = GeneradorFalso(plantillas)
    proveedor = ProveedorFalso()
    movimiento = _movimiento()

    documentos = generar_documentos_movimiento(
        generador, proveedor, movimiento, proceso='movimiento:traslado',
        evento={'modulo_origen': 'cargos', 'oficina_anterior_id': 9},
    )

    assert [d.id for d in documentos] == ['doc-p-1', 'doc-p-2']
    assert proveedor.llamadas == [('V12345678', 23, {'modulo_origen': 'cargos', 'oficina_anterior_id': 9})]
    llamadas = [llamada for llamada in generador.llamadas if llamada[0] == 'generar']
    assert [llamada[1] for llamada in llamadas] == ['p-1', 'p-2']
    for _, plantilla_id, kwargs in llamadas:
        assert plantilla_id in ('p-1', 'p-2')
        assert kwargs['sujeto_tipo'] == 'trabajador'
        assert kwargs['sujeto_id'] == 'V12345678'
        assert kwargs['trabajador_cedula'] == 'V12345678'
        assert kwargs['actor_id'] == 7
        assert kwargs['estricto'] is False
        datos = kwargs['datos']
        assert datos['nombre_completo'] == 'PEREZ ANA'
        assert datos['correo'] == 'ana@example.com'
        assert datos['origen'] == 'OFICINA ANTERIOR - NIVEL ANTERIOR'
        assert datos['destino'] == 'COD-23 - ANALISTA - OFICINA DE GESTION HUMANA'
        assert datos['motivo'] == 'TRASLADO POR NECESIDAD'
        assert datos['fecha'] == '25/11/2026' and datos['fecha_efectiva'] == '25/11/2026'
        assert datos['cargo_destino'] == 'ANALISTA' and datos['tipo_personal'] == 'ACTIVO'
        assert datos['numero'] == '23'
        assert datos['movimiento_id'] == 23
        assert datos['proceso'] == 'movimiento:traslado'
        assert [f['etiqueta'] for f in datos['firmantes']] == ['Trabajador', 'CONATEL']


def test_no_duplica_resultados_si_el_servicio_repite_un_id():
    generador = GeneradorFalso([
        PlantillaDocumentoMovimiento('p-1', 'P1', 'Primero'),
        PlantillaDocumentoMovimiento('p-2', 'P2', 'Segundo'),
    ])
    def generar_repetido(plantilla_id, **kwargs):
        return DocumentoGeneradoMovimiento(
            id='doc-repetido', plantilla_id=plantilla_id, sujeto_tipo='trabajador',
            sujeto_id='V12345678', datos_snapshot={}, pdf_sha256='sha',
        )

    generador.generar_plantilla = generar_repetido

    documentos = generar_documentos_movimiento(
        generador, ProveedorFalso(), _movimiento(), proceso='movimiento:traslado',
    )

    assert len(documentos) == 1


def test_serializer_del_historial_expone_documentos_generados_y_enlaces():
    movimiento = _movimiento()
    documento = {
        'id': '5f0d88c2-7f2f-4d55-9a4e-86f4a4f529d1',
        'nombre': 'Constancia de traslado',
        'proceso': 'movimiento:traslado',
        'version': 2,
        'sha': 'a' * 64,
        'fecha': '2026-11-25T14:00:00+00:00',
        'url': '/api/v1/documentos/generados/5f0d88c2-7f2f-4d55-9a4e-86f4a4f529d1/archivo/',
        'detalle_url': '/api/v1/documentos/generados/5f0d88c2-7f2f-4d55-9a4e-86f4a4f529d1/',
    }

    datos = MovimientoCargoSerializer(
        movimiento, context={'documentos_por_movimiento': {movimiento.id: [documento]}},
    ).data

    assert datos['documentos_generados'] == [documento]
    assert MovimientoCargoSerializer(movimiento).data['documentos_generados'] == []
