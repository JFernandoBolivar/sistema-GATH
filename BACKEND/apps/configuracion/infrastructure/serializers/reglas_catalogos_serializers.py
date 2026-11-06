"""
Serializers para Reglas de Catálogos (A5).
"""
from rest_framework import serializers


class ReglaParentescoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    descripcion = serializers.CharField(read_only=True)
    aplica_familiar = serializers.BooleanField()


class ActualizarParentescoSerializer(serializers.Serializer):
    descripcion = serializers.CharField(min_length=2, max_length=100, required=False)
    aplica_familiar = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not any(k in attrs for k in ('descripcion', 'aplica_familiar')):
            raise serializers.ValidationError('Debe indicar al menos un campo a actualizar.')
        return attrs


class CrearParentescoSerializer(serializers.Serializer):
    descripcion = serializers.CharField(min_length=2, max_length=100, required=True)
    aplica_familiar = serializers.BooleanField(required=False, default=True)


class CategoriaMotivoItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    categoria = serializers.CharField(read_only=True)


class ReglaMotivoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    movimiento = serializers.CharField(read_only=True)
    categoria_id = serializers.IntegerField(read_only=True)
    categoria_nombre = serializers.CharField(read_only=True)
    es_reservado = serializers.BooleanField(read_only=True)
    activo = serializers.BooleanField(read_only=True)


class CambiarCategoriaMotivoSerializer(serializers.Serializer):
    categoria_id = serializers.IntegerField(required=True)


class ActualizarMotivoSerializer(serializers.Serializer):
    movimiento = serializers.CharField(min_length=3, max_length=100, required=False)
    categoria_id = serializers.IntegerField(required=False)
    activo = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not any(k in attrs for k in ('movimiento', 'categoria_id', 'activo')):
            raise serializers.ValidationError('Debe indicar al menos un campo a actualizar.')
        return attrs


class CrearMotivoSerializer(serializers.Serializer):
    movimiento = serializers.CharField(min_length=3, max_length=100, required=True)
    categoria_id = serializers.IntegerField(required=True)


class ReglaNominaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nomina = serializers.CharField(read_only=True)
    requiere_codig = serializers.BooleanField()
    es_activo = serializers.BooleanField()


class ActualizarNominaSerializer(serializers.Serializer):
    nomina = serializers.CharField(min_length=2, max_length=50, required=False)
    es_activo = serializers.BooleanField(required=False, default=None)
    requiere_codig = serializers.BooleanField(required=False, default=None)

    def validate(self, attrs):
        if (
            attrs.get('nomina') is None
            and attrs.get('es_activo') is None
            and attrs.get('requiere_codig') is None
        ):
            raise serializers.ValidationError(
                'Debe indicar al menos un campo a actualizar (nomina, es_activo o requiere_codig).'
            )
        return attrs


class CrearNominaSerializer(serializers.Serializer):
    nomina = serializers.CharField(min_length=2, max_length=50, required=True)
    es_activo = serializers.BooleanField(required=False, default=True)
    requiere_codig = serializers.BooleanField(required=False, default=False)


class ReglasCatalogosCompletoSerializer(serializers.Serializer):
    parentescos = ReglaParentescoSerializer(many=True)
    categorias_motivo = CategoriaMotivoItemSerializer(many=True)
    motivos = ReglaMotivoSerializer(many=True)
    nominas = ReglaNominaSerializer(many=True)
