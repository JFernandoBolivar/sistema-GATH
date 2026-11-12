"""Serializers del restablecimiento de acceso en bloque (U2)."""
from rest_framework import serializers

from apps.identidad.domain.value_objects.restablecimiento_bloque import Alcance, Clasificacion

MOTIVO_MIN = 10
MOTIVO_MAX = 500


class RestablecerAccesoBloqueSerializer(serializers.Serializer):
    clasificacion = serializers.ChoiceField(
        choices=[c.value for c in Clasificacion], default=Clasificacion.AMBOS.value,
    )
    alcance = serializers.ChoiceField(
        choices=[a.value for a in Alcance], default=Alcance.VENCIDA.value,
    )
    enviar_correo = serializers.BooleanField(default=True)
    motivo = serializers.CharField(min_length=MOTIVO_MIN, max_length=MOTIVO_MAX, trim_whitespace=True)


class EjecutarRestablecimientoBloqueSerializer(RestablecerAccesoBloqueSerializer):
    confirmacion = serializers.IntegerField(min_value=0)


class ResultadoRestablecimientoBloqueSerializer(serializers.Serializer):
    revisadas = serializers.IntegerField()
    activos = serializers.IntegerField()
    pasivos = serializers.IntegerField()
    total = serializers.IntegerField()
    omitidas_administrativas = serializers.IntegerField()
    restablecidas = serializers.IntegerField()
    errores = serializers.IntegerField()
    enviar_correo = serializers.BooleanField()
    dry_run = serializers.BooleanField()


class EstadoRestablecimientoBloqueSerializer(serializers.Serializer):
    task_id = serializers.CharField()
    estado = serializers.CharField()
    resultado = serializers.DictField(required=False)
    mensaje = serializers.CharField(required=False)


class FiltrosExcelBloqueSerializer(serializers.Serializer):
    clasificacion = serializers.ChoiceField(
        choices=[c.value for c in Clasificacion], default=Clasificacion.AMBOS.value,
    )
    alcance = serializers.ChoiceField(
        choices=[a.value for a in Alcance], default=Alcance.VENCIDA.value,
    )
