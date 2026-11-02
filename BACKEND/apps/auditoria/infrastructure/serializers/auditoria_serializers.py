"""Serializers de la bitácora de auditoría (D10)."""
from rest_framework import serializers


class RegistroAuditoriaSerializer(serializers.Serializer):
    id = serializers.CharField()
    fecha_hora = serializers.CharField()
    actor_cedula = serializers.CharField()
    actor_nombre = serializers.CharField()
    actor_rol = serializers.CharField()
    modulo = serializers.CharField()
    accion = serializers.CharField()
    recurso_tipo = serializers.CharField()
    recurso_id = serializers.CharField()
    ip = serializers.CharField()
    user_agent = serializers.CharField()
    resultado = serializers.CharField()


class DiferenciaSerializer(serializers.Serializer):
    campo = serializers.CharField()
    antes = serializers.JSONField(allow_null=True)
    despues = serializers.JSONField(allow_null=True)


class DetalleAuditoriaSerializer(RegistroAuditoriaSerializer):
    estado_previo = serializers.JSONField(allow_null=True)
    estado_nuevo = serializers.JSONField(allow_null=True)
    diferencias = DiferenciaSerializer(many=True)


class IncidenteSeguridadSerializer(serializers.Serializer):
    id = serializers.CharField()
    fecha_hora = serializers.CharField()
    cedula = serializers.CharField()
    nombre = serializers.CharField()
    ip = serializers.CharField()
    resultado = serializers.CharField()


class OpcionesAuditoriaSerializer(serializers.Serializer):
    acciones = serializers.ListField(child=serializers.CharField())
    modulos = serializers.ListField(child=serializers.CharField())
    resultados = serializers.ListField(child=serializers.CharField())
