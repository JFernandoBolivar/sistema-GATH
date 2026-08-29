"""
Serializers de Presentación de Catálogos.
"""
from rest_framework import serializers


class CatalogoItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    codigo = serializers.CharField(read_only=True, allow_null=True, required=False)
    extra = serializers.DictField(read_only=True, required=False)


class RegionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)


class EstadoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    region_id = serializers.IntegerField(read_only=True, allow_null=True)


class MunicipioSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    estado_id = serializers.IntegerField(read_only=True)


class ParroquiaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    municipio_id = serializers.IntegerField(read_only=True)
