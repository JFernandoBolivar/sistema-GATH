from django.apps import apps
from django.db.models import Prefetch

from AUTOGESTION.utils.mapa_reporte import MAPA_REPORTES
from RAC.models.personal_models import Employee
from RAC.utils.constants import PERSONAL_ACTIVO


def build_censo_queryset(filtros):
    config = MAPA_REPORTES.get("censo_vivienda", {})
    filtros_permitidos = config.get("filtros_permitidos", {})

    query_filtros = {"respuestas_encuesta__isnull": False}
    asignacion_filtros = {}

    for k, v in filtros.items():
        if v is not None and k in filtros_permitidos:
            campo = filtros_permitidos[k]
            query_filtros[campo] = v
            if "assignments__" in campo:
                asignacion_filtros[campo.replace("assignments__", "")] = v

    query_filtros["assignments__Tipo_personal__tipo_personal"] = PERSONAL_ACTIVO
    asignacion_filtros["Tipo_personal__tipo_personal"] = PERSONAL_ACTIVO

    AsigTrabajo = apps.get_model("RAC", "AsigTrabajo")

    return Employee.objects.filter(
        **query_filtros
    ).prefetch_related(
        Prefetch(
            "assignments",
            queryset=AsigTrabajo.objects.filter(**asignacion_filtros).select_related(
                "Dependencia",
                "DireccionGeneral",
                "DireccionLinea",
                "Coordinacion",
                "tiponominaid",
                "Tipo_personal",
            ).order_by("-fecha_actualizacion"),
            to_attr="filtered_assignments",
        )
    ).distinct().order_by("cedulaidentidad")
