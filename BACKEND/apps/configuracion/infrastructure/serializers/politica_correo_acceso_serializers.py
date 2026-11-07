"""
Serializers para la Política de Correo de Acceso (A7).
"""
from core.domain.limites_texto import MOTIVO_MIN, MOTIVO_MAX, mensajes_texto
from rest_framework import serializers


class PoliticaCorreoAccesoSerializer(serializers.Serializer):
    # O39: el alternativo no es login de un pasivo; solo principal o ficha.
    politica_pasivos = serializers.ChoiceField(choices=['institucional', 'correo_ficha'])
    politica_activos = serializers.ChoiceField(
        choices=['alternativo', 'institucional', 'correo_ficha']
    )
    si_falta_elegido = serializers.ChoiceField(
        choices=['dejar_sin_cuenta', 'usar_siguiente']
    )
    avisar_al_aplicar_masivo = serializers.BooleanField(default=False)


class ItemVistaPreviaSerializer(serializers.Serializer):
    cedula = serializers.CharField()
    nombre_completo = serializers.CharField()
    condicion = serializers.CharField()
    correo_actual = serializers.CharField(allow_blank=True)
    correo_propuesto = serializers.CharField(allow_null=True)
    cambiara = serializers.BooleanField()
    quedara_sin_cuenta = serializers.BooleanField()
    es_excepcion_manual = serializers.BooleanField()
    motivo_exclusion = serializers.CharField(allow_null=True)


class ResumenVistaPreviaSerializer(serializers.Serializer):
    total_evaluados = serializers.IntegerField()
    cambian = serializers.IntegerField()
    quedan_igual = serializers.IntegerField()
    quedan_sin_cuenta = serializers.IntegerField()
    excepciones_manuales_ignoradas = serializers.IntegerField()
    items = ItemVistaPreviaSerializer(many=True)


class AplicarPoliticaMasivaRequestSerializer(serializers.Serializer):
    grupo = serializers.ChoiceField(choices=['activos', 'pasivos'])
    motivo = serializers.CharField(min_length=MOTIVO_MIN, max_length=MOTIVO_MAX, error_messages=mensajes_texto('El motivo', MOTIVO_MIN, MOTIVO_MAX))
    incluir_excepciones = serializers.BooleanField(default=False)
