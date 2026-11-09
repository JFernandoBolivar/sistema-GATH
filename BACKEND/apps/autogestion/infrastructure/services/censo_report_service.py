from django.db.models import Count, Q, F

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.autogestion.infrastructure.models.autogestion_models import RespuestasEncuestaModel


def construir_grafico_torta(dep_ids, dg_ids, dl_ids, coord_ids):
    base_qs = AsigTrabajoModel.objects.filter(employee__isnull=False)
    if coord_ids:
        base_qs = base_qs.filter(Coordinacion_id__in=coord_ids)
    elif dl_ids:
        base_qs = base_qs.filter(DireccionLinea_id__in=dl_ids)
    elif dg_ids:
        base_qs = base_qs.filter(DireccionGeneral_id__in=dg_ids)
    elif dep_ids:
        base_qs = base_qs.filter(Dependencia_id__in=dep_ids)

    empleados_cedulas = list(base_qs.values_list('employee_id', flat=True).distinct())
    total = len(empleados_cedulas)
    if total == 0:
        return [
            {"name": "Respondido", "value": 0},
            {"name": "No Respondido", "value": 0},
        ]

    respondidos = (
        RespuestasEncuestaModel.objects.filter(empleado_id__in=empleados_cedulas)
        .values('empleado_id')
        .distinct()
        .count()
    )

    return [
        {"name": "Respondido", "value": respondidos},
        {"name": "No Respondido", "value": max(0, total - respondidos)},
    ]


def construir_grafico_barras(dep_ids, dg_ids, dl_ids, coord_ids):
    base_filter = Q(employee__isnull=False)

    if coord_ids:
        base_filter &= Q(Coordinacion_id__in=coord_ids)
        group_field = "Coordinacion__coordinacion"
        null_check = "Coordinacion"
    elif dl_ids:
        base_filter &= Q(DireccionLinea_id__in=dl_ids)
        group_field = "Coordinacion__coordinacion"
        null_check = "Coordinacion"
    elif dg_ids:
        base_filter &= Q(DireccionGeneral_id__in=dg_ids)
        group_field = "DireccionLinea__direccion_linea"
        null_check = "DireccionLinea"
    elif dep_ids:
        base_filter &= Q(Dependencia_id__in=dep_ids)
        group_field = "DireccionGeneral__direccion_general"
        null_check = "DireccionGeneral"
    else:
        group_field = "Dependencia__dependencia"
        null_check = "Dependencia"

    rows = (
        AsigTrabajoModel.objects
        .filter(base_filter)
        .filter(**{f"{null_check}__isnull": False})
        .values(key=F(group_field))
        .annotate(total=Count('employee', distinct=True))
        .order_by('key')
    )

    result = []
    for row in rows:
        key_name = row['key']
        if not key_name:
            continue
        sub_filter = {group_field: key_name}
        cargos_sub = AsigTrabajoModel.objects.filter(base_filter).filter(**sub_filter)
        sub_cedulas = list(cargos_sub.values_list('employee_id', flat=True).distinct())
        respondidos = (
            RespuestasEncuestaModel.objects.filter(empleado_id__in=sub_cedulas)
            .values('empleado_id')
            .distinct()
            .count()
        )
        total_sub = row['total']
        result.append({
            "key": key_name,
            "total": total_sub,
            "respondidos": respondidos,
            "no_respondidos": max(0, total_sub - respondidos),
        })

    return result
