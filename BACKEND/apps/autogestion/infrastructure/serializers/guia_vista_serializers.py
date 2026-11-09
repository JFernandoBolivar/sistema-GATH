"""
Serializadores de lectura y entrada para guías interactivas vistas (O35).
"""
from rest_framework import serializers


class GuiaVistaSerializer(serializers.Serializer):
    guia_id = serializers.CharField(max_length=64)
    version = serializers.IntegerField(min_value=1)
    fecha_vista = serializers.DateTimeField()


class MarcarGuiaVistaInputSerializer(serializers.Serializer):
    guia_id = serializers.CharField(max_length=64, min_length=2)
    version = serializers.IntegerField(min_value=1, default=1, required=False)
