"""
Serializers de Presentación de catálogos de soporte del expediente de personal
(vivienda, académico, contrato, salud).

Un `CatalogoItemSerializer` genérico sirve para las tablas maestras de solo
lectura: `{ id, nombre }`. Filas con un campo único de texto (`politicas`,
`condicion_vivienda`, `GrupoSanguineo`, `NivelAcademico`, `carreras`,
`Menciones`, `Instituciones`) y las geográficas se aplanan al mismo contrato
para que el frontend las consuma igual.
"""
from rest_framework import serializers


class CatalogoItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    codigo = serializers.CharField(read_only=True, allow_null=True, required=False)


# ----------------------------------------------------------------------
# Serializers de Escritura y Detalle (CRUD de Soporte)
# ----------------------------------------------------------------------

class CategoriaWriteSerializer(serializers.Serializer):
    nombre_categoria = serializers.CharField(max_length=200)


class CategoriaDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre_categoria = serializers.CharField(read_only=True)


class AlergiaWriteSerializer(serializers.Serializer):
    alergia = serializers.CharField(max_length=200)
    categoria_id = serializers.IntegerField(required=False, allow_null=True)
    categoriaId = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if 'categoria_id' not in attrs and 'categoriaId' in attrs:
            attrs['categoria_id'] = attrs['categoriaId']
        if not attrs.get('categoria_id'):
            raise serializers.ValidationError({'categoria_id': 'Este campo es requerido.'})
        return attrs


class AlergiaDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    alergia = serializers.CharField(source='nombre', read_only=True)
    categoria_id = serializers.IntegerField(read_only=True)
    categoria_nombre = serializers.CharField(read_only=True, allow_blank=True)


class PatologiaWriteSerializer(serializers.Serializer):
    patologia = serializers.CharField(max_length=200)
    categoria_id = serializers.IntegerField(required=False, allow_null=True)
    categoriaId = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if 'categoria_id' not in attrs and 'categoriaId' in attrs:
            attrs['categoria_id'] = attrs['categoriaId']
        if not attrs.get('categoria_id'):
            raise serializers.ValidationError({'categoria_id': 'Este campo es requerido.'})
        return attrs


class PatologiaDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    patologia = serializers.CharField(source='nombre', read_only=True)
    categoria_id = serializers.IntegerField(read_only=True)
    categoria_nombre = serializers.CharField(read_only=True, allow_blank=True)


class DiscapacidadWriteSerializer(serializers.Serializer):
    discapacidad = serializers.CharField(max_length=200)
    categoria_id = serializers.IntegerField(required=False, allow_null=True)
    categoriaId = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if 'categoria_id' not in attrs and 'categoriaId' in attrs:
            attrs['categoria_id'] = attrs['categoriaId']
        if not attrs.get('categoria_id'):
            raise serializers.ValidationError({'categoria_id': 'Este campo es requerido.'})
        return attrs


class DiscapacidadDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    discapacidad = serializers.CharField(source='nombre', read_only=True)
    categoria_id = serializers.IntegerField(read_only=True)
    categoria_nombre = serializers.CharField(read_only=True, allow_blank=True)


class TallaWriteSerializer(serializers.Serializer):
    valor = serializers.CharField(max_length=50)
    region_id = serializers.IntegerField(required=False, allow_null=True)
    region = serializers.IntegerField(required=False, allow_null=True)
    tipo_prenda_id = serializers.IntegerField(required=False, allow_null=True)
    tipo_prenda = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if 'region_id' not in attrs and 'region' in attrs:
            attrs['region_id'] = attrs['region']
        if 'tipo_prenda_id' not in attrs and 'tipo_prenda' in attrs:
            attrs['tipo_prenda_id'] = attrs['tipo_prenda']
        if not attrs.get('region_id'):
            raise serializers.ValidationError({'region_id': 'Este campo es requerido.'})
        if not attrs.get('tipo_prenda_id'):
            raise serializers.ValidationError({'tipo_prenda_id': 'Este campo es requerido.'})
        return attrs


class TallaDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    valor = serializers.CharField(read_only=True)
    region_id = serializers.IntegerField(read_only=True)
    tipo_prenda_id = serializers.IntegerField(read_only=True)
    region_codigo = serializers.CharField(read_only=True, allow_blank=True)
    tipo_prenda_nombre = serializers.CharField(read_only=True, allow_blank=True)


class RegionTallaWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=10)
    descripcion = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)


class RegionTallaDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    descripcion = serializers.CharField(read_only=True, allow_blank=True)


class TipoPrendaWriteSerializer(serializers.Serializer):
    categoria = serializers.CharField(max_length=50)


class TipoPrendaDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    categoria = serializers.CharField(read_only=True)
