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
    correo = serializers.EmailField(max_length=254, required=False, allow_blank=True)
    telefono_movil = serializers.CharField(max_length=30, required=False, allow_blank=True)
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


# --- Bandeja y flujo de Captación (D-7, D-8) ---
class FiltrosBandejaSerializer(serializers.Serializer):
    """Query: `estado` repetible o separado por comas, `q`, `desde`, `hasta` (fecha del último cambio)."""

    estado = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    q = serializers.CharField(max_length=100, required=False, allow_blank=True)
    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)


class TransicionSerializer(serializers.Serializer):
    destino = serializers.CharField(max_length=30)
    motivo = serializers.CharField(max_length=2000, required=False, allow_blank=True, default='')
    datos = serializers.DictField(
        required=False, default=dict,
        help_text=(
            "Solo al abrir hacia Presupuesto: cargo_id, cargo_especifico_id, tipo_nomina_id, direccion_general_id, "
            "direccion_linea_id, coordinacion_id, dependencia_id (ids de catálogo, la oficina es la jerarquía "
            "organizativa), cargo_texto, oficina_texto, observaciones. Se exige un cargo y una oficina (id o texto)."
        ),
    )


class PsicofisicoSerializer(serializers.Serializer):
    """Multipart: `resultado` (APTO|NO_APTO), `fecha_aplicacion` (AAAA-MM-DD), `observaciones?`, `informe?` (PDF ≤ 10 MB)."""

    resultado = serializers.ChoiceField(choices=['APTO', 'NO_APTO'])
    fecha_aplicacion = serializers.DateField()
    observaciones = serializers.CharField(max_length=2000, required=False, allow_blank=True, default='')
    informe = serializers.FileField(required=False, allow_empty_file=False)


class ExpedienteDetalleSerializer(serializers.Serializer):
    expediente = serializers.JSONField()
    postulante = serializers.JSONField()
    datos_ventana1 = serializers.JSONField()
    historial = serializers.ListField(child=serializers.JSONField())
    psicofisico = serializers.JSONField(allow_null=True)
    acciones = serializers.ListField(child=serializers.JSONField())


class BandejaRespuestaSerializer(serializers.Serializer):
    resultados = serializers.ListField(child=serializers.JSONField())
    total = serializers.IntegerField()
    pagina = serializers.IntegerField()
    tamano = serializers.IntegerField()
    total_paginas = serializers.IntegerField()


class PsicofisicoRespuestaSerializer(serializers.Serializer):
    resultado = serializers.CharField()
    fecha_aplicacion = serializers.DateField()
    observaciones = serializers.CharField(allow_blank=True)
    tiene_informe = serializers.BooleanField()
    informe_tamano = serializers.IntegerField()
    registrado_por = serializers.CharField(allow_blank=True)
    registrado_el = serializers.DateTimeField()
    sugiere_rechazo = serializers.BooleanField()
