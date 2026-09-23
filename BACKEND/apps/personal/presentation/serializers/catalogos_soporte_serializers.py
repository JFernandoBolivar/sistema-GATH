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
    categoria_id = serializers.IntegerField(read_only=True, allow_null=True, required=False)
    categoria_nombre = serializers.CharField(read_only=True, allow_null=True, required=False)
    categoria = serializers.SerializerMethodField(required=False)
    tipo_prenda_id = serializers.IntegerField(read_only=True, allow_null=True, required=False)
    tipo_prenda_nombre = serializers.CharField(read_only=True, allow_null=True, required=False)
    tipo_prenda = serializers.SerializerMethodField(required=False)
    region_id = serializers.IntegerField(read_only=True, allow_null=True, required=False)
    region_codigo = serializers.CharField(read_only=True, allow_null=True, required=False)
    region_descripcion = serializers.CharField(read_only=True, allow_null=True, required=False)
    region = serializers.SerializerMethodField(required=False)

    def get_categoria(self, obj):
        cat_id = getattr(obj, 'categoria_id', None)
        cat_nom = getattr(obj, 'categoria_nombre', None)
        if cat_id is not None or cat_nom is not None:
            return {'id': cat_id, 'nombre': cat_nom, 'nombre_categoria': cat_nom}
        return None

    def get_tipo_prenda(self, obj):
        tipo_id = getattr(obj, 'tipo_prenda_id', None)
        tipo_nom = getattr(obj, 'tipo_prenda_nombre', None)
        if tipo_id is not None or tipo_nom is not None:
            return {'id': tipo_id, 'categoria': tipo_nom}
        return None

    def get_region(self, obj):
        reg_id = getattr(obj, 'region_id', None)
        reg_cod = getattr(obj, 'region_codigo', None)
        reg_desc = getattr(obj, 'region_descripcion', None)
        if reg_id is not None or reg_cod is not None:
            return {'id': reg_id, 'codigo': reg_cod, 'descripcion': reg_desc}
        return None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        optional_keys = [
            'categoria_id', 'categoria_nombre', 'categoria',
            'tipo_prenda_id', 'tipo_prenda_nombre', 'tipo_prenda',
            'region_id', 'region_codigo', 'region_descripcion', 'region',
        ]
        for key in optional_keys:
            if ret.get(key) is None:
                ret.pop(key, None)
        return ret



class CodigoPostalSerializer(CatalogoItemSerializer):
    """`{ id, nombre, estado_id }`: incluye el estado para la cascada Estado -> Código Postal."""
    estado_id = serializers.IntegerField(read_only=True)


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


# ----------------------------------------------------------------------
# Alta inline de catálogos académicos (opción "Otra X" del registro)
# ----------------------------------------------------------------------

class CarreraWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)
    nivel_academico_id = serializers.IntegerField(min_value=1)


class CarreraDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    nivel_academico_id = serializers.IntegerField(read_only=True, allow_null=True)


class MencionWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)
    carrera_id = serializers.IntegerField(min_value=1)


class MencionDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    carrera_id = serializers.IntegerField(read_only=True)


class InstitucionWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)


class InstitucionDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)


class CapacitacionWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)


class CapacitacionDetalleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
