from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class TrabajoExportacionSerializer(serializers.Serializer):
    """Estado público de una exportación: nunca expone la clave del almacén ni los filtros."""

    id = serializers.CharField()
    tipo = serializers.CharField()
    formato = serializers.CharField()
    estado = serializers.SerializerMethodField()
    progreso = serializers.IntegerField()
    nombre_archivo = serializers.CharField()
    tamano_bytes = serializers.IntegerField()
    error = serializers.CharField()
    creado_en = serializers.DateTimeField()
    expira_en = serializers.DateTimeField()
    total_encontrados = serializers.SerializerMethodField()
    limite = serializers.SerializerMethodField()
    truncado = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField())
    def get_estado(self, obj) -> str:
        return obj.estado.value

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_total_encontrados(self, obj):
        return obj.metadatos.get('total_encontrados')

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_limite(self, obj):
        return obj.metadatos.get('limite')

    @extend_schema_field(serializers.BooleanField())
    def get_truncado(self, obj):
        return bool(obj.metadatos.get('truncado'))
