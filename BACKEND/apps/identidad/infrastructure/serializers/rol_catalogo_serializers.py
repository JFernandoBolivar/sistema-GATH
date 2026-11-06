"""
Serializers del catálogo de roles (CRUD, CRIT-12).

Serializan la entidad de dominio `Rol` (reutilizada de la matriz de permisos,
`domain/entities/rol.py`) sin su tupla `permisos` (aquí el CRUD es solo sobre
el registro `nombre`/`descripcion`).
"""
from core.domain.limites_texto import OBSERVACION_MIN, OBSERVACION_MAX, mensajes_texto
from rest_framework import serializers


class RolCatalogoLecturaSerializer(serializers.Serializer):
    """Representación de un rol del catálogo (id, nombre, descripción)."""

    id = serializers.IntegerField(source='identificador')
    nombre_rol = serializers.CharField(source='nombre')
    descripcion_rol = serializers.CharField(source='descripcion', allow_blank=True)
    n_usuarios = serializers.IntegerField(required=False, default=0)
    n_permisos = serializers.IntegerField(required=False, default=0)


class RolCatalogoEscrituraSerializer(serializers.Serializer):
    """Alta/edición de un rol. La normalización y unicidad viven en el caso de uso."""

    nombre_rol = serializers.CharField(
        min_length=2, max_length=50, required=False, allow_blank=True, trim_whitespace=True
    )
    descripcion_rol = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, min_length=OBSERVACION_MIN, max_length=OBSERVACION_MAX,
        error_messages=mensajes_texto('La descripción', OBSERVACION_MIN, OBSERVACION_MAX),
    )
