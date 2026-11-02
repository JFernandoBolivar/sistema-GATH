"""
Serializers de lectura del módulo identidad (B3.1).

Solo transforman salida hacia el sobre C-1; ninguna regla de negocio (B8).
"""
from rest_framework import serializers


class PermisoLecturaSerializer(serializers.Serializer):
    """Representación de un `Permiso` de dominio: código + nombre."""

    codigo = serializers.CharField(source='codigo.valor')
    nombre = serializers.CharField()


class PermisosEfectivosSerializer(serializers.Serializer):
    """Códigos efectivos resueltos para una cuenta (`obtener_permisos_de_cuenta`)."""

    cedula = serializers.CharField()
    rol_id = serializers.IntegerField(allow_null=True)
    codigos = serializers.ListField(
        child=serializers.CharField(), allow_empty=True
    )
