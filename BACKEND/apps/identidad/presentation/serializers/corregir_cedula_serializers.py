"""Serializers de la corrección de la cédula de un trabajador."""
from rest_framework import serializers

from apps.identidad.application.use_cases.corregir_cedula import MOTIVO_MAX, MOTIVO_MIN

_CEDULA = {'regex': r'^\d{6,9}$', 'error_messages': {'invalid': 'La cédula debe tener solo dígitos, de 6 a 9.'}}


class VistaPreviaCorreccionCedulaSerializer(serializers.Serializer):
    cedula_actual = serializers.RegexField(**_CEDULA)
    cedula_nueva = serializers.RegexField(**_CEDULA)

    def validate(self, attrs):
        if attrs['cedula_actual'] == attrs['cedula_nueva']:
            raise serializers.ValidationError('La cédula nueva no puede ser igual a la actual.')
        return attrs


class CorregirCedulaSerializer(VistaPreviaCorreccionCedulaSerializer):
    motivo = serializers.CharField(min_length=MOTIVO_MIN, max_length=MOTIVO_MAX, trim_whitespace=True)
    confirmacion = serializers.CharField()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs['confirmacion'].strip() != attrs['cedula_nueva']:
            raise serializers.ValidationError(
                {'confirmacion': 'La confirmación debe ser igual a la cédula nueva.'}
            )
        return attrs


class AfectadoSerializer(serializers.Serializer):
    tabla = serializers.CharField()
    registros = serializers.IntegerField()


class TrabajadorCorreccionSerializer(serializers.Serializer):
    cedula_actual = serializers.CharField()
    nombre = serializers.CharField()
    condicion = serializers.CharField()


class CuentaCorreccionSerializer(serializers.Serializer):
    existe = serializers.BooleanField()
    correo = serializers.CharField(allow_null=True)
    clave_inicial_pendiente = serializers.BooleanField()


class VistaPreviaCorreccionRespuestaSerializer(serializers.Serializer):
    trabajador = TrabajadorCorreccionSerializer()
    cedula_nueva = serializers.CharField()
    cuenta = CuentaCorreccionSerializer()
    afectados = AfectadoSerializer(many=True)
    total_registros = serializers.IntegerField()


class ResultadoCorreccionSerializer(serializers.Serializer):
    cedula_anterior = serializers.CharField()
    cedula_nueva = serializers.CharField()
    afectados = AfectadoSerializer(many=True)
    total_registros = serializers.IntegerField()
    clave_inicial_actualizada = serializers.BooleanField()
