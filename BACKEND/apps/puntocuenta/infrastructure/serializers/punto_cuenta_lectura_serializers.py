"""Serializer de lectura de Punto de Cuenta — el caso de uso devuelve un
DTO (dataclass), no un modelo ORM, por eso es `serializers.Serializer` plano."""
from rest_framework import serializers


class PuntoCuentaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    cargo_id = serializers.IntegerField()
    empleado_cedula = serializers.CharField()
    empleado_nombre = serializers.CharField(allow_null=True)
    dependencia_origen_id = serializers.IntegerField(allow_null=True)
    dependencia_origen_nombre = serializers.CharField(allow_null=True)
    dependencia_destino_id = serializers.IntegerField(allow_null=True)
    dependencia_destino_nombre = serializers.CharField(allow_null=True)
    motivo_id = serializers.IntegerField(allow_null=True)
    motivo_nombre = serializers.CharField(allow_null=True)
    usuario_id = serializers.IntegerField(allow_null=True)
    fecha = serializers.CharField()
    documento_generado = serializers.BooleanField()
