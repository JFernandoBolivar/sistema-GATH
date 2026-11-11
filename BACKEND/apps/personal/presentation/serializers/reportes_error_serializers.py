"""
Serializers DRF para Reportes de Error en Datos Laborales (C-1 / D-10).
"""
from core.domain.limites_texto import OBSERVACION_MIN, mensajes_texto
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.personal.domain.entities.reporte_error import (
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
    DatoLaboralReportado,
)


class CrearReporteErrorSerializer(serializers.Serializer):
    dato = serializers.ChoiceField(
        choices=[(d.value, d.name) for d in DatoLaboralReportado],
        error_messages={'invalid_choice': 'Seleccione un dato válido (cargo, oficina, fecha_ingreso u otro).'},
    )
    descripcion = serializers.CharField(
        min_length=LONGITUD_MINIMA_DESCRIPCION,
        max_length=LONGITUD_MAXIMA_DESCRIPCION,
        trim_whitespace=True,
        error_messages={
            'min_length': f'La descripción debe tener al menos {LONGITUD_MINIMA_DESCRIPCION} caracteres.',
            'max_length': f'La descripción no puede exceder {LONGITUD_MAXIMA_DESCRIPCION} caracteres.',
            'blank': 'La descripción del error no puede estar vacía.',
        },
    )


class AtenderReporteErrorSerializer(serializers.Serializer):
    observacion = serializers.CharField(
        min_length=OBSERVACION_MIN,
        max_length=LONGITUD_MAXIMA_DESCRIPCION,
        error_messages=mensajes_texto('La observación', OBSERVACION_MIN, LONGITUD_MAXIMA_DESCRIPCION),
        required=False,
        allow_blank=True,
        trim_whitespace=True,
        default='',
    )


ETIQUETAS_DATO = {
    'cargo': 'Cargo',
    'oficina': 'Oficina / Gerencia',
    'fecha_ingreso': 'Fecha de ingreso',
    'otro': 'Otro dato laboral',
}


class ReporteErrorLecturaSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    trabajador_cedula = serializers.CharField()
    trabajador_nombre = serializers.CharField()
    dato = serializers.SerializerMethodField()
    dato_etiqueta = serializers.SerializerMethodField()
    descripcion = serializers.CharField()
    estado = serializers.SerializerMethodField()
    creado_el = serializers.DateTimeField()
    actualizado_el = serializers.DateTimeField()
    atendido_por_cedula = serializers.CharField(allow_blank=True)
    atendido_por_nombre = serializers.CharField(allow_blank=True)
    atendido_el = serializers.DateTimeField(allow_null=True)
    observacion_atencion = serializers.CharField(allow_blank=True)

    @extend_schema_field(serializers.CharField())
    def get_dato(self, obj) -> str:
        return str(getattr(obj.dato, 'value', obj.dato))

    @extend_schema_field(serializers.CharField())
    def get_estado(self, obj) -> str:
        return str(getattr(obj.estado, 'value', obj.estado))

    @extend_schema_field(serializers.CharField())
    def get_dato_etiqueta(self, obj) -> str:
        dato_val = getattr(obj.dato, 'value', str(obj.dato))
        return ETIQUETAS_DATO.get(dato_val, dato_val)
