"""Serializers de credenciales externas y temporales (O45-A)."""
from rest_framework import serializers


class CredencialExternaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    tipo_credencial = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    documento = serializers.CharField(read_only=True)
    correo = serializers.CharField(read_only=True)
    empresa = serializers.CharField(read_only=True)
    contrato = serializers.CharField(read_only=True)
    persona_visitada = serializers.CharField(read_only=True)
    motivo = serializers.CharField(read_only=True)
    vigencia_desde = serializers.CharField(read_only=True)
    vigencia_hasta = serializers.CharField(read_only=True)
    estado = serializers.CharField(read_only=True)
    security_hash = serializers.CharField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True, allow_null=True)
    observaciones = serializers.CharField(read_only=True)
    devuelta_en = serializers.CharField(read_only=True, allow_null=True)
    anulada_en = serializers.CharField(read_only=True, allow_null=True)


class CrearCredencialExternaSerializer(serializers.Serializer):
    tipo_codigo = serializers.CharField(max_length=50)
    nombre = serializers.CharField(max_length=150)
    documento = serializers.CharField(max_length=50)
    motivo = serializers.CharField(max_length=200)
    vigencia_desde = serializers.DateTimeField()
    vigencia_hasta = serializers.DateTimeField(required=False, allow_null=True, default=None)
    correo = serializers.EmailField(required=False, allow_blank=True, default='')
    empresa = serializers.CharField(required=False, allow_blank=True, default='', max_length=150)
    contrato = serializers.CharField(required=False, allow_blank=True, default='', max_length=100)
    persona_visitada = serializers.CharField(
        required=False, allow_blank=True, default='', max_length=150
    )
    empleado_cedula = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=None, max_length=20
    )
    observaciones = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs.get('vigencia_hasta') and attrs['vigencia_hasta'] <= attrs['vigencia_desde']:
            raise serializers.ValidationError(
                {'vigencia_hasta': ['La vigencia final debe ser posterior a la inicial.']}
            )
        return attrs


class CrearTemporalSerializer(CrearCredencialExternaSerializer):
    empleado_cedula = serializers.CharField(max_length=20)

    def validate_empleado_cedula(self, value):
        if not str(value).strip():
            raise serializers.ValidationError('El trabajador es obligatorio.')
        return value


class LoteCredencialesInputSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.CharField(max_length=64), allow_empty=False, min_length=1
    )


class EnviarCredencialInputSerializer(serializers.Serializer):
    destinatario = serializers.EmailField(required=False, allow_blank=True, default='')
