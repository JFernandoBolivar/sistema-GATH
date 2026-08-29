"""
Serializers de Presentación de Autogestión.
"""
from rest_framework import serializers


class OpcionPreguntaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    texto = serializers.CharField(read_only=True)
    orden = serializers.IntegerField(read_only=True)


class PreguntaEncuestaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    enunciado = serializers.CharField(read_only=True)
    tipo = serializers.CharField(read_only=True)
    orden = serializers.IntegerField(read_only=True)
    activo = serializers.BooleanField(read_only=True)
    validacion = serializers.CharField(read_only=True, allow_null=True)
    opciones = OpcionPreguntaSerializer(many=True, read_only=True)


class RespuestaEncuestaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    pregunta_id = serializers.IntegerField(read_only=True)
    pregunta_enunciado = serializers.CharField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True)
    opcion_id = serializers.IntegerField(read_only=True, allow_null=True)
    opcion_texto = serializers.CharField(read_only=True, allow_null=True)
    respuesta_texto = serializers.CharField(read_only=True)


class ItemRespuestaInputSerializer(serializers.Serializer):
    pregunta_id = serializers.IntegerField(required=True)
    opcion_id = serializers.IntegerField(required=False, allow_null=True)
    respuesta = serializers.CharField(required=False, allow_blank=True, default="")


class RegistrarCensoInputSerializer(serializers.Serializer):
    respuestas = ItemRespuestaInputSerializer(many=True, required=True)
