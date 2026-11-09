"""
Serializer de lectura del catálogo de departamentos.
"""
from rest_framework import serializers


class DepartamentoLecturaSerializer(serializers.Serializer):
    """Representación de un `Departamento` de dominio."""

    id = serializers.IntegerField()
    nombre = serializers.CharField()
    descripcion = serializers.CharField(allow_blank=True)
