"""
Serializers del catálogo de roles (CRUD, CRIT-12).

Serializan la entidad de dominio `Rol` (reutilizada de la matriz de permisos,
`domain/entities/rol.py`) sin su tupla `permisos` (aquí el CRUD es solo sobre
el registro `nombre`/`descripcion`).
"""
from rest_framework import serializers


class RolCatalogoLecturaSerializer(serializers.Serializer):
    """Representación de un rol del catálogo (id, nombre, descripción)."""

    id = serializers.IntegerField(source='identificador')
    nombre_rol = serializers.CharField(source='nombre')
    descripcion_rol = serializers.CharField(source='descripcion', allow_blank=True)


class RolCatalogoEscrituraSerializer(serializers.Serializer):
    """Alta/edición de un rol. La normalización y unicidad viven en el caso de uso."""

    nombre_rol = serializers.CharField(max_length=50, required=False, allow_blank=True)
    descripcion_rol = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
