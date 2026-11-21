"""Serializers de entrada y de documentación de la API de postulación (D-4)."""
from rest_framework import serializers

from core.presentation.validadores_personas import validar_cedula, validar_drf, validar_nombre, validar_telefono


class AccesoSerializer(serializers.Serializer):
    cedula = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


class CambiarClaveSerializer(serializers.Serializer):
    clave_actual = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    clave_nueva = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


class BorradorSerializer(serializers.Serializer):
    nombres = serializers.CharField(max_length=150)
    apellidos = serializers.CharField(max_length=150)
    correo = serializers.EmailField(max_length=254, required=False, allow_blank=True, default='')
    telefono_movil = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    datos_ventana1 = serializers.DictField(
        required=False,
        help_text=(
            "Esquema (todas las claves opcionales): fecha_nacimiento (AAAA-MM-DD), sexo (M|F), nacionalidad (V|E), "
            "estado_civil, direccion_habitacion, telefono_alterno, contacto_emergencia {nombre, telefono, parentesco}. "
            "Omitido = sin cambios; presente = reemplaza. Para enviar la Ventana 1 se exigen fecha_nacimiento y sexo."
        ),
    )


class AltaPostulanteSerializer(serializers.Serializer):
    cedula = serializers.CharField(max_length=15)
    nombres = serializers.CharField(max_length=150)
    apellidos = serializers.CharField(max_length=150)
    correo = serializers.EmailField(max_length=254, required=False, allow_blank=True, default='')
    telefono_movil = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')

    def validate_cedula(self, value):
        return validar_drf(validar_cedula, value) or ''

    def validate_nombres(self, value):
        return validar_drf(validar_nombre, value, edicion=True, etiqueta="Los nombres")

    def validate_apellidos(self, value):
        return validar_drf(validar_nombre, value, edicion=True, etiqueta="Los apellidos")

    def validate_telefono_movil(self, value):
        return validar_drf(validar_telefono, value, tipo='movil') or ''


# --- Solo documentación de las respuestas (el sobre C-1 envuelve `data`) ---
class ExpedienteResumenSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    numero = serializers.CharField()
    estado = serializers.CharField()
    ventana = serializers.IntegerField(allow_null=True)
    vence_el = serializers.DateTimeField(allow_null=True)


class SesionInvitadoSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="JWT de invitado: enviar como `Authorization: Bearer <token>`.")
    tipo = serializers.CharField()
    scope = serializers.CharField(help_text="`expediente:<id>`")
    expira_el = serializers.DateTimeField()
    expira_en_segundos = serializers.IntegerField()
    debe_cambiar_clave = serializers.BooleanField()
    expediente = ExpedienteResumenSerializer()


class MiExpedienteSerializer(serializers.Serializer):
    expediente = serializers.JSONField()
    postulante = serializers.JSONField()
    datos_ventana1 = serializers.JSONField()
    campos_pendientes = serializers.ListField(child=serializers.CharField())


class EnvioSerializer(serializers.Serializer):
    sesion_cerrada = serializers.BooleanField()
    expediente = serializers.JSONField()


class CredencialEmitidaSerializer(serializers.Serializer):
    usuario = serializers.CharField(help_text="La cédula del postulante.")
    clave_temporal = serializers.CharField(help_text="Se muestra UNA sola vez; no se puede volver a consultar.")
    ventana = serializers.IntegerField()
    vence_el = serializers.DateTimeField()
    debe_cambiar_clave = serializers.BooleanField()


class AltaPostulanteRespuestaSerializer(serializers.Serializer):
    postulante = serializers.JSONField()
    expediente = ExpedienteResumenSerializer()
    es_reingreso = serializers.BooleanField()
    credencial = CredencialEmitidaSerializer()
