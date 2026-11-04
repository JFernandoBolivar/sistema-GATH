"""Serializer de lectura de una versión de imagen del cintillo (entidad plana)."""
from rest_framework import serializers


class VersionImagenCintilloSerializer(serializers.Serializer):
    id = serializers.CharField()
    campo = serializers.CharField()
    mime = serializers.CharField()
    tamano = serializers.IntegerField()
    subido_en = serializers.CharField()
    subido_por_cedula = serializers.CharField(allow_blank=True)
    subido_por_nombre = serializers.CharField(allow_blank=True)
    es_vigente = serializers.BooleanField()
    url = serializers.CharField()
