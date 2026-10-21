"""
Serializers para los endpoints de recuperación y restablecimiento de contraseña.
"""
from rest_framework import serializers


class SolicitarRecuperacionSerializer(serializers.Serializer):
    identificador = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=150,
        help_text="Correo electrónico institucional o cédula de identidad del trabajador.",
    )
    frontend_url = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="URL base opcional del frontend emisor.",
    )


class RestablecerPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Token firmado de recuperación recibido por correo electrónico.",
    )
    password_nuevo = serializers.CharField(
        required=True,
        write_only=True,
        min_length=8,
        help_text="Nueva contraseña de acceso que cumpla con los estándares de seguridad.",
    )
    password_confirmacion = serializers.CharField(
        required=True,
        write_only=True,
        min_length=8,
        help_text="Confirmación idéntica de la nueva contraseña.",
    )
