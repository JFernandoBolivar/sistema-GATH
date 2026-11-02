"""
Serializer de entrada para los endpoints de carga masiva (gap #4).
"""
from rest_framework import serializers


class CargaMasivaArchivoSerializer(serializers.Serializer):
    archivo = serializers.FileField()
