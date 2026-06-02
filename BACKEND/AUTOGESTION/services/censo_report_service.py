from django.db.models import Count, Q, F

from RAC.models.personal_models import (
    Employee,
    AsigTrabajo,
)
from AUTOGESTION.models.models_encuestas import RespuestasEncuesta
from RAC.utils.constants import PERSONAL_ACTIVO


def _build_employee_filter(dep_ids, dg_ids, dl_ids, coord_ids):
    """
    Construye un Q() para filtrar Employee a través de sus
    asignaciones activas según el nivel jerárquico más granular.
    """
    filtro = Q(
        assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
    )

    if coord_ids:
        filtro &= Q(assignments__Coordinacion__in=coord_ids)
    elif dl_ids:
        filtro &= Q(assignments__DireccionLinea__in=dl_ids)
    elif dg_ids:
        filtro &= Q(assignments__DireccionGeneral__in=dg_ids)
    elif dep_ids:
        filtro &= Q(assignments__DireccionGeneral__dependenciaId__in=dep_ids)

    return filtro


def construir_grafico_torta(dep_ids, dg_ids, dl_ids, coord_ids):
    """
    Cuenta empleados que respondieron vs los que no respondieron
    el censo, usando dos queries simples sobre Employee.

    Retorna: [{"name": str, "value": int}, ...]
    """
    filtro = _build_employee_filter(dep_ids, dg_ids, dl_ids, coord_ids)
    base_qs = Employee.objects.filter(filtro).distinct()

    total = base_qs.count()
    if total == 0:
        return [
            {"name": "Respondido", "value": 0},
            {"name": "No Respondido", "value": 0},
        ]

    respondidos = base_qs.filter(
        respuestas_encuesta__isnull=False
    ).distinct().count()

    return [
        {"name": "Respondido", "value": respondidos},
        {"name": "No Respondido", "value": total - respondidos},
    ]


def construir_grafico_barras(dep_ids, dg_ids, dl_ids, coord_ids):
    """
    Agrupa empleados por el sub-nivel inmediato de la jerarquía
    seleccionada y cuenta totales vs respondidos.

    Jerarquía: Dependencia → DireccionGeneral → DireccionLinea → Coordinacion

    Retorna: [{"key": str, "metric1": int, "metric2": int}, ...]
      - metric1: empleados que respondieron
      - metric2: total de empleados
    """
    base_filter = Q(
        Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO,
        employee__isnull=False,
    )

    if coord_ids:
        base_filter &= Q(Coordinacion__in=coord_ids)
        group_field = "Coordinacion__coordinacion"
        null_check = "Coordinacion"
    elif dl_ids:
        base_filter &= Q(DireccionLinea__in=dl_ids)
        group_field = "Coordinacion__coordinacion"
        null_check = "Coordinacion"
    elif dg_ids:
        base_filter &= Q(DireccionGeneral__in=dg_ids)
        group_field = "DireccionLinea__direccion_linea"
        null_check = "DireccionLinea"
    elif dep_ids:
        base_filter &= Q(DireccionGeneral__dependenciaId__in=dep_ids)
        group_field = "DireccionGeneral__direccion_general"
        null_check = "DireccionGeneral"
    else:
        # Sin filtros: reporte general agrupado por Dependencia
        group_field = "DireccionGeneral__dependenciaId__dependencia"
        null_check = "DireccionGeneral__dependenciaId"

    rows = (
        AsigTrabajo.objects
        .filter(base_filter)
        .filter(**{f"{null_check}__isnull": False})
        .values(key=F(group_field))
        .annotate(
            total=Count("employee", distinct=True),
            respondidos=Count(
                "employee",
                filter=Q(employee__respuestas_encuesta__isnull=False),
                distinct=True,
            ),
        )
        .order_by("key")
    )

    return [
        {
            "key": row["key"],
            "total": row["total"],
            "respondidos": row["respondidos"],
            "no_respondidos": row["total"] - row["respondidos"],
        }
        for row in rows
    ]
