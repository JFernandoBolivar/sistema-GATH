"""
Serializers de Presentación de Movimientos.
"""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class DocumentoGeneradoMovimientoSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    proceso = serializers.CharField(read_only=True)
    version = serializers.IntegerField(read_only=True)
    sha = serializers.CharField(read_only=True)
    fecha = serializers.DateTimeField(read_only=True)
    url = serializers.CharField(read_only=True)
    detalle_url = serializers.CharField(read_only=True)


class MovimientoCargoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True)
    codigo_puesto = serializers.CharField(read_only=True)
    tipo_movimiento = serializers.CharField(read_only=True)
    motivo_id = serializers.IntegerField(read_only=True, allow_null=True)
    motivo_nombre = serializers.CharField(read_only=True, allow_null=True)
    denominacion_nombre = serializers.CharField(read_only=True)
    especifica_nombre = serializers.CharField(read_only=True)
    grado_nombre = serializers.CharField(read_only=True, allow_null=True)
    tipo_nomina_nombre = serializers.CharField(read_only=True)
    estatus_nombre = serializers.CharField(read_only=True)
    tipo_personal_nombre = serializers.CharField(read_only=True, allow_null=True)
    dependencia_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_general_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_linea_nombre = serializers.CharField(read_only=True, allow_null=True)
    coordinacion_nombre = serializers.CharField(read_only=True, allow_null=True)
    fecha_movimiento = serializers.CharField(read_only=True)
    ejecutado_por_id = serializers.IntegerField(read_only=True)
    ejecutado_por_nombre = serializers.CharField(read_only=True)
    documentos_generados = serializers.SerializerMethodField()

    @extend_schema_field(DocumentoGeneradoMovimientoSerializer(many=True))
    def get_documentos_generados(self, obj) -> list[dict]:
        return self.context.get('documentos_por_movimiento', {}).get(obj.id, [])
