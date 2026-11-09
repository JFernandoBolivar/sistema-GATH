"""
Serializers de Presentación de Reportes.
"""
from rest_framework import serializers


class ResultadoReporteSerializer(serializers.Serializer):
    titulo = serializers.CharField(read_only=True)
    columnas = serializers.ListField(child=serializers.CharField(), read_only=True)
    filas = serializers.ListField(child=serializers.DictField(), read_only=True)
    total_registros = serializers.IntegerField(read_only=True)
    metadatos = serializers.DictField(read_only=True)
