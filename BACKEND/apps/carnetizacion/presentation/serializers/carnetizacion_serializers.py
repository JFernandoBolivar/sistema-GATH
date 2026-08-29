"""
Serializers de Presentación de Carnetización.
"""
from rest_framework import serializers


class CarnetSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True)
    empleado_nombres = serializers.CharField(read_only=True)
    empleado_apellidos = serializers.CharField(read_only=True)
    security_hash = serializers.CharField(read_only=True)
    fecha_emision = serializers.CharField(read_only=True)
    motivo_id = serializers.IntegerField(read_only=True)
    motivo_nombre = serializers.CharField(read_only=True)
    activo = serializers.BooleanField(read_only=True)
    observaciones = serializers.CharField(read_only=True, allow_null=True)


class EmitirCarnetInputSerializer(serializers.Serializer):
    empleado_cedula = serializers.CharField(required=True, max_length=20)
    motivo_id = serializers.IntegerField(required=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class PlantillaCarnetSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    imagen_url = serializers.CharField(read_only=True)
    activo = serializers.BooleanField(read_only=True)
    creado = serializers.CharField(read_only=True)


class ValidacionCarnetSerializer(serializers.Serializer):
    es_valido = serializers.BooleanField(read_only=True)
    mensaje = serializers.CharField(read_only=True)
    carnet = CarnetSerializer(read_only=True, allow_null=True)
