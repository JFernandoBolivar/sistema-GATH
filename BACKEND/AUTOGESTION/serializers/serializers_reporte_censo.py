from rest_framework import serializers

from RAC.models.personal_models import (
    Dependencias,
    DireccionGeneral,
    DireccionLinea,
    Coordinaciones,
)


# ── Serializer de entrada (validación del POST) ─────────────────────────

class ReporteCensoDependenciasSerializer(serializers.Serializer):
    dependencia_id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="IDs de Dependencias a consultar.",
    )
    direccion_general_id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="IDs de Direcciones Generales a consultar.",
    )
    direccion_linea_id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="IDs de Direcciones de Línea a consultar.",
    )
    coordinacion_id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="IDs de Coordinaciones a consultar.",
    )

    def validate(self, data):
        dep = data.get("dependencia_id", [])
        dg = data.get("direccion_general_id", [])
        dl = data.get("direccion_linea_id", [])
        coord = data.get("coordinacion_id", [])

        # Si no se envía ningún ID, se genera un reporte general
        # de todas las dependencias.

        validations = [
            (dep, Dependencias, "dependencias"),
            (dg, DireccionGeneral, "direcciones generales"),
            (dl, DireccionLinea, "direcciones de línea"),
            (coord, Coordinaciones, "coordinaciones"),
        ]

        for ids, model, label in validations:
            if ids:
                existing = model.objects.filter(id__in=ids).count()
                if existing != len(set(ids)):
                    raise serializers.ValidationError(
                        f"Una o más {label} no existen en la base de datos."
                    )

        return data


# ── Serializers de salida (documentación Swagger) ────────────────────────

class GraficoTortaItemSerializer(serializers.Serializer):
    name = serializers.CharField(help_text="Etiqueta del segmento (Respondido / No Respondido).")
    value = serializers.IntegerField(help_text="Cantidad de empleados.")


class GraficoBarrasItemSerializer(serializers.Serializer):
    key = serializers.CharField(help_text="Nombre del sub-nivel organizacional.")
    total = serializers.IntegerField(help_text="Total de empleados en ese sub-nivel.")
    respondidos = serializers.IntegerField(help_text="Empleados que respondieron el censo.")
    no_respondidos = serializers.IntegerField(help_text="Empleados que NO respondieron el censo.")


class ReporteCensoResponseSerializer(serializers.Serializer):
    pie_chart = GraficoTortaItemSerializer(many=True)
    bar_chart = GraficoBarrasItemSerializer(many=True)
