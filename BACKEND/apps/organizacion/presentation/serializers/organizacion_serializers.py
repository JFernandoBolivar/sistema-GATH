"""
Serializers de Presentación de Organización.
"""
from rest_framework import serializers


class DependenciaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)


class DireccionGeneralSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    dependencia_id = serializers.IntegerField(read_only=True, allow_null=True)


class DireccionLineaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    direccion_general_id = serializers.IntegerField(read_only=True, allow_null=True)


class CoordinacionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    direccion_linea_id = serializers.IntegerField(read_only=True, allow_null=True)
    direccion_general_id = serializers.IntegerField(read_only=True, allow_null=True)


class OrganismoAdscritoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    parent_id = serializers.IntegerField(read_only=True, allow_null=True)
