"""Serializers de los parámetros del sistema (D9)."""
from rest_framework import serializers


class OpcionParametroSerializer(serializers.Serializer):
    etiqueta = serializers.CharField()

    def to_representation(self, instance):
        valor, etiqueta = instance
        return {'valor': valor, 'etiqueta': etiqueta}


class ParametroSerializer(serializers.Serializer):
    clave = serializers.CharField()
    etiqueta = serializers.CharField()
    descripcion = serializers.CharField()
    grupo = serializers.CharField()
    tipo = serializers.CharField()
    valor = serializers.CharField()
    defecto = serializers.CharField()
    minimo = serializers.IntegerField(allow_null=True)
    maximo = serializers.IntegerField(allow_null=True)
    actualizado_por_id = serializers.IntegerField(allow_null=True)
    actualizado_en = serializers.CharField(allow_null=True)
    opciones = OpcionParametroSerializer(many=True)
    depende_de = serializers.SerializerMethodField()

    def get_depende_de(self, obj):
        dep = getattr(obj, 'depende_de', None)
        if not dep:
            return None
        return {'clave': dep[0], 'valor': dep[1]}


class ParametroActualizarSerializer(serializers.Serializer):
    valor = serializers.CharField(max_length=2000, allow_blank=True, trim_whitespace=True)


class CambioParametroSerializer(serializers.Serializer):
    fecha = serializers.CharField()
    actor_cedula = serializers.CharField()
    valor_previo = serializers.CharField()
    valor_nuevo = serializers.CharField()
    resultado = serializers.CharField()
    agregados = serializers.ListField(child=serializers.CharField(), required=False)
    quitados = serializers.ListField(child=serializers.CharField(), required=False)
    resumen_cambio = serializers.CharField(allow_null=True, required=False)


class TrabajadorSelectorSerializer(serializers.Serializer):
    cedula = serializers.CharField()
    nombre = serializers.CharField()
    tiene_cuenta = serializers.BooleanField()
    cuenta_activa = serializers.BooleanField()
