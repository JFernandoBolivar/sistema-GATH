"""
Serializers estándar para documentación OpenAPI y respuestas unificadas (Contrato C-1).
"""
from rest_framework import serializers


class MensajeRespuestaSerializer(serializers.Serializer):
    """
    Serializer estándar para documentar respuestas con el sobre de envelope (C-1).
    
    Estructura:
    - Éxito: { "status": "success", "message": "...", "data": <T> }
    - Error: { "status": "error", "message": "...", "data": null }
    """
    status = serializers.ChoiceField(
        choices=["success", "error"],
        help_text="Estado de la operación: 'success' o 'error'."
    )
    message = serializers.CharField(
        help_text="Mensaje descriptivo y seguro para el usuario final."
    )
    data = serializers.JSONField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Payload de datos de la respuesta o null si es una operación sin contenido."
    )
