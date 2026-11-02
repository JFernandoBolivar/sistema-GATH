"""Serializers de los parámetros del sistema (D9)."""
from rest_framework import serializers


class ParametroSerializer(serializers.Serializer):
    clave = serializers.CharField()
    etiqueta = serializers.CharField()
    descripcion = serializers.CharField()
    grupo = serializers.CharField()
    tipo = serializers.CharField()
    valor = serializers.CharField()
    defecto = serializers.CharField()
    minimo = serializers.IntegerField(allow_null=True)
    maximo = serializers.IntegerField(allow_null=True)
    actualizado_por_id = serializers.IntegerField(allow_null=True)
    actualizado_en = serializers.CharField(allow_null=True)


class ParametroActualizarSerializer(serializers.Serializer):
    valor = serializers.CharField(max_length=255, allow_blank=False, trim_whitespace=True)


class CambioParametroSerializer(serializers.Serializer):
    fecha = serializers.CharField()
    actor_cedula = serializers.CharField()
    valor_previo = serializers.CharField()
    valor_nuevo = serializers.CharField()
    resultado = serializers.CharField()
