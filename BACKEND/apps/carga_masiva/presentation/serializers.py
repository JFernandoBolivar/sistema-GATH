from rest_framework import serializers


class PlantillaQuerySerializer(serializers.Serializer):
    tipos = serializers.CharField(required=False, allow_blank=True, help_text='Claves separadas por coma; vacío = todos.')
    modo = serializers.ChoiceField(choices=['obligatorios', 'completo'], required=False, default='obligatorios')
    poblacion = serializers.ChoiceField(
        choices=['ACTIVOS', 'PASIVOS'], required=False, default='ACTIVOS',
        help_text='Población de la plantilla: ACTIVOS o PASIVOS.',
    )

    def validate_tipos(self, valor):
        return [parte.strip() for parte in (valor or '').split(',') if parte.strip()]


class ConfirmarFilasSerializer(serializers.Serializer):
    filas = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text='Identificadores de las filas que requieren confirmación.',
    )
