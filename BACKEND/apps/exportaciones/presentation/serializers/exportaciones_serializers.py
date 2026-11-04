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

    def get_estado(self, obj) -> str:
        return obj.estado.value

    def get_total_encontrados(self, obj):
        return obj.metadatos.get('total_encontrados')

    def get_limite(self, obj):
        return obj.metadatos.get('limite')

    def get_truncado(self, obj):
        return bool(obj.metadatos.get('truncado'))
