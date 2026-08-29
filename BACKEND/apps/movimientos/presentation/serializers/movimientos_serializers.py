"""
Serializers de Presentación de Movimientos.
"""
from rest_framework import serializers


class MovimientoCargoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True)
    codigo_puesto = serializers.CharField(read_only=True)
    tipo_movimiento = serializers.CharField(read_only=True)
    motivo_id = serializers.IntegerField(read_only=True, allow_null=True)
    motivo_nombre = serializers.CharField(read_only=True, allow_null=True)
    denominacion_nombre = serializers.CharField(read_only=True)
    especifica_nombre = serializers.CharField(read_only=True)
    grado_nombre = serializers.CharField(read_only=True, allow_null=True)
    tipo_nomina_nombre = serializers.CharField(read_only=True)
    estatus_nombre = serializers.CharField(read_only=True)
    tipo_personal_nombre = serializers.CharField(read_only=True, allow_null=True)
    dependencia_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_general_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_linea_nombre = serializers.CharField(read_only=True, allow_null=True)
    coordinacion_nombre = serializers.CharField(read_only=True, allow_null=True)
    fecha_movimiento = serializers.CharField(read_only=True)
    ejecutado_por_id = serializers.IntegerField(read_only=True)
    ejecutado_por_nombre = serializers.CharField(read_only=True)
