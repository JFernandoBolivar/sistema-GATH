"""
Serializers de Presentación de Catálogos.
"""
from rest_framework import serializers


class CatalogoItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    codigo = serializers.CharField(read_only=True, allow_null=True, required=False)
    extra = serializers.DictField(read_only=True, required=False)


class CrearParentescoInputSerializer(serializers.Serializer):
    descripcion = serializers.CharField(
        min_length=2,
        max_length=60,
        trim_whitespace=True,
        error_messages={
            'min_length': 'La descripción del parentesco debe tener entre 2 y 60 caracteres.',
            'max_length': 'La descripción del parentesco debe tener entre 2 y 60 caracteres.',
            'blank': 'La descripción es requerida.',
        },
    )
    uso = serializers.ChoiceField(
        choices=['contacto'],
        error_messages={
            'invalid_choice': "El uso indicado debe ser 'contacto'.",
        },
    )


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
