from rest_framework import serializers
from django.db import transaction

from AUTOGESTION.models.models_encuestas import (
    TipoPregunta,
    PreguntasEncuestas,
    OpcionesPregunta,
    RespuestasEncuesta,
)
from RAC.models.personal_models import Employee
from RAC.serializers.catalogs_serializers import DatosViviendaSerializer
from RAC.services.profile_services import upsert_vivienda


class TipoPreguntaSerializer(serializers.ModelSerializer):

    class Meta:
        model = TipoPregunta
        fields = ["id", "nombre"]


class OpcionesPreguntaSerializer(serializers.ModelSerializer):

    class Meta:
        model = OpcionesPregunta
        fields = ["id", "tipo_opcion"]


class PreguntasEncuestasSerializer(serializers.ModelSerializer):
    tipo = TipoPreguntaSerializer(read_only=True)
    opciones = OpcionesPreguntaSerializer(many=True, read_only=True)

    class Meta:
        model = PreguntasEncuestas
        fields = ["id", "enunciado", "tipo", "opciones"]


class RespuestaEncuestaSerializer(serializers.ModelSerializer):
    empleado = serializers.ReadOnlyField(source="empleado.cedulaidentidad")
    opcion = OpcionesPreguntaSerializer(read_only=True)

    class Meta:
        model = RespuestasEncuesta
        fields = ["id", "pregunta", "empleado", "opcion", "respuesta"]


class RespuestaEncuestaItemSerializer(serializers.Serializer):
    pregunta = serializers.IntegerField()
    opcion = serializers.IntegerField(required=False, allow_null=True)
    respuesta = serializers.CharField(required=False, allow_blank=True, default="")


class CensoViviendaSubmitSerializer(serializers.Serializer):
    carnet_patria = serializers.CharField(required=False, allow_blank=True, default="")
    datos_vivienda = DatosViviendaSerializer(required=False)
    respuestas = RespuestaEncuestaItemSerializer(many=True)

    def validate_respuestas(self, value):
        if not value:
            raise serializers.ValidationError("Debe enviar al menos una respuesta.")

        for item in value:
            pregunta_id = item["pregunta"]
            opcion_id = item.get("opcion")
            respuesta_texto = item.get("respuesta", "")

            try:
                pregunta = PreguntasEncuestas.objects.select_related("tipo").get(
                    id=pregunta_id, activo=True
                )
            except PreguntasEncuestas.DoesNotExist:
                raise serializers.ValidationError(
                    f"La pregunta con id {pregunta_id} no existe o no está activa."
                )

            if pregunta.tipo.nombre == "cerrada":
                if not opcion_id:
                    raise serializers.ValidationError(
                        f"Debe seleccionar una opción para '{pregunta.enunciado}'."
                    )
                if not OpcionesPregunta.objects.filter(
                    id=opcion_id, pregunta_id=pregunta_id
                ).exists():
                    raise serializers.ValidationError(
                        f"La opción {opcion_id} no pertenece a la pregunta '{pregunta.enunciado}'."
                    )

        return value

    @transaction.atomic
    def create(self, validated_data):
        empleado = self.context["empleado"]
        carnet_patria = validated_data.get("carnet_patria", "")
        vivienda_data = validated_data.get("datos_vivienda")
        respuestas_data = validated_data.get("respuestas", [])

        if carnet_patria:
            empleado.carnet_patria = carnet_patria
            empleado.save(update_fields=["carnet_patria", "fecha_actualizacion"])

        if vivienda_data:
            upsert_vivienda(empleado, vivienda_data)

        for item in respuestas_data:
            RespuestasEncuesta.objects.update_or_create(
                pregunta_id=item["pregunta"],
                empleado=empleado,
                defaults={
                    "opcion_id": item.get("opcion"),
                    "respuesta": item.get("respuesta", ""),
                },
            )

        return validated_data
