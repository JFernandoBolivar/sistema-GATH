from rest_framework import serializers
from django.db import transaction

from AUTOGESTION.models.models_encuestas import (
    TipoPregunta,
    PreguntasEncuestas,
    OpcionesPregunta,
    RespuestasEncuesta,
)
from RAC.serializers.catalogs_serializers import DatosViviendaSerializer
from RAC.serializers.personal_activo_serializers import ListerCodigosSerializer
from RAC.services.profile_services import upsert_vivienda
from RAC.utils.tiempo_servicio import calcular_total_apn
from AUTOGESTION.utils.mapa_reporte import MAPA_REPORTES


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


class CensoEmpleadoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    cedula = serializers.CharField(source="cedulaidentidad")
    nombres = serializers.CharField()
    apellidos = serializers.CharField()
    fecha_nacimiento = serializers.SerializerMethodField()
    carnet_patria = serializers.CharField()
    cargos = ListerCodigosSerializer(many=True, source="assignments")
    datos_vivienda = serializers.SerializerMethodField()
    total_apn = serializers.SerializerMethodField()
    fecha_ingreso_organismo = serializers.SerializerMethodField()
    preguntas = serializers.SerializerMethodField()

    def get_fecha_nacimiento(self, obj):
        return obj.fecha_nacimiento.isoformat() if obj.fecha_nacimiento else None

    def get_datos_vivienda(self, obj):
        vivienda = obj.datos_vivienda_set.first()
        if vivienda:
            return DatosViviendaSerializer(vivienda).data
        return None

    def get_total_apn(self, obj):
        cerrados = obj.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)
        return calcular_total_apn(cerrados)

    def get_fecha_ingreso_organismo(self, obj):
        primera = obj.antecedentes_servicio_set.order_by("fecha_ingreso").first()
        if primera and primera.fecha_ingreso:
            return primera.fecha_ingreso.isoformat()
        return None

    def get_preguntas(self, obj):
        respuestas = RespuestasEncuesta.objects.filter(
            empleado=obj
        ).select_related("pregunta__tipo", "opcion")
        return [
            {
                "id": r.pregunta_id,
                "pregunta": r.pregunta.enunciado,
                "tipo": r.pregunta.tipo.nombre,
                "opcion": {"id": r.opcion_id, "opcion": r.opcion.tipo_opcion} if r.opcion else None,
                "respuesta": r.respuesta,
            }
            for r in respuestas
        ]


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


class CensoExcelFiltrosSerializer(serializers.Serializer):
    filtros = serializers.JSONField(required=False, default=dict)

    def validate_filtros(self, value):
        config = MAPA_REPORTES.get("censo_vivienda", {})
        filtros_permitidos = config.get("filtros_permitidos", {})
        for key in value:
            if key not in filtros_permitidos:
                raise serializers.ValidationError(
                    f"El filtro '{key}' no esta permitido. Filtros disponibles: {list(filtros_permitidos.keys())}"
                )
        return value


class CensoExcelRowSerializer(serializers.Serializer):
    cedula = serializers.CharField(source="cedulaidentidad")
    nombres = serializers.CharField()
    apellidos = serializers.CharField()
    fecha_nacimiento = serializers.SerializerMethodField()
    carnet_patria = serializers.CharField()
    apn = serializers.SerializerMethodField()
    fecha_ingreso_organismo = serializers.SerializerMethodField()
    direccion_general = serializers.SerializerMethodField()
    tipo_nomina = serializers.SerializerMethodField()
    direccion_vivienda = serializers.SerializerMethodField()
    codigo_postal = serializers.SerializerMethodField()

    def get_fecha_nacimiento(self, obj):
        return obj.fecha_nacimiento.isoformat() if obj.fecha_nacimiento else ""

    def get_apn(self, obj):
        cerrados = obj.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)
        apn = calcular_total_apn(cerrados)
        y, m, d = apn["years"], apn["months"], apn["days"]
        if y == 0 and m == 0 and d == 0:
            return "0"
        return f"{y} años, {m} meses, {d} días"

    def get_fecha_ingreso_organismo(self, obj):
        primera = obj.antecedentes_servicio_set.order_by("fecha_ingreso").first()
        if primera and primera.fecha_ingreso:
            return primera.fecha_ingreso.isoformat()
        return ""

    def get_direccion_general(self, obj):
        asignaciones = getattr(obj, "filtered_assignments", [])
        if asignaciones and asignaciones[0].DireccionGeneral:
            return asignaciones[0].DireccionGeneral.direccion_general
        return ""

    def get_tipo_nomina(self, obj):
        asignaciones = getattr(obj, "filtered_assignments", [])
        if asignaciones and asignaciones[0].tiponominaid:
            return asignaciones[0].tiponominaid.nomina
        return ""

    def get_direccion_vivienda(self, obj):
        vivienda = obj.datos_vivienda_set.first()
        return vivienda.direccion_exacta if vivienda else ""

    def get_codigo_postal(self, obj):
        vivienda = obj.datos_vivienda_set.first()
        return vivienda.codigo_postal_id.codigo if vivienda and vivienda.codigo_postal_id else ""
