"""Serializer de escritura de Configuración Visual (PUT parcial)."""
from rest_framework import serializers


class ConfiguracionVisualActualizarSerializer(serializers.Serializer):
    tipo_cintillo = serializers.ChoiceField(choices=['GENERICO', 'FIJO'], required=False)
    nombre_empresa = serializers.CharField(required=False, allow_null=True, max_length=200)
    color_fondo = serializers.RegexField(
        r'^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$', required=False, allow_null=True,
        error_messages={'invalid': 'El color de fondo debe ser un hexadecimal válido (ej. #1E3A8A).'},
    )
