from rest_framework import serializers
from ..models import CarnetTemplate


class CarnetTemplateSerializer(serializers.ModelSerializer):
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = CarnetTemplate
        fields = ['id', 'nombre', 'imagen', 'imagen_url', 'activo', 'creado']
        read_only_fields = ['creado']

    def get_imagen_url(self, obj):
        if obj.imagen:
            return obj.imagen.url
        return None

    def validate_imagen(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('La imagen no debe superar 5MB')
        return value
