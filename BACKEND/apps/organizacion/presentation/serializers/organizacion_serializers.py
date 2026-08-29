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


class OrganismoAdscritoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    parent_id = serializers.IntegerField(read_only=True, allow_null=True)


class DependenciaWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=20, required=True)
    nombre = serializers.CharField(max_length=200, required=True)


class DireccionGeneralWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=20, required=True)
    nombre = serializers.CharField(max_length=200, required=True)
    dependencia_id = serializers.IntegerField(required=False, allow_null=True)


class DireccionLineaWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=20, required=True)
    nombre = serializers.CharField(max_length=200, required=True)
    direccion_general_id = serializers.IntegerField(required=False, allow_null=True)


class CoordinacionWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=20, required=True)
    nombre = serializers.CharField(max_length=200, required=True)
    direccion_linea_id = serializers.IntegerField(required=False, allow_null=True)


class OrganismoAdscritoWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=50, required=True)
    parent_id = serializers.IntegerField(required=False, allow_null=True)
