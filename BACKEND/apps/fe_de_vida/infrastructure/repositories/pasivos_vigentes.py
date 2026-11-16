"""Criterio único de «pasivo vigente» para las consultas de fe de vida.

Al egresar a un pasivo, su asignación no se borra (se conserva para el
histórico): solo cambia `estatusid` a EGRESADO. Las consultas de fe de vida
deben usar la asignación PASIVO más reciente del alcance y descartar al
trabajador si esa asignación está en EGRESADO, igual que hace el módulo de
Pasivos. Así un egresado deja de contar como pendiente.
"""
from django.db.models import OuterRef, Q, Subquery

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO
from core.domain.catalogos import ESTATUS_EGRESADO

CAMPO_ESTATUS_PASIVO = "_estatus_pasivo_vigente"


def asignaciones_pasivas(
    tipos_nomina: tuple[int, ...] = (),
    outer_ref: str = "cedulaidentidad",
):
    """Asignaciones PASIVO del alcance, de la más reciente a la más antigua."""
    filtro = Q(
        employee_id=OuterRef(outer_ref),
        Tipo_personal__tipo_personal__iexact=CONDICION_PASIVO,
    )
    if tipos_nomina:
        filtro &= Q(tiponominaid_id__in=tipos_nomina)
    return AsigTrabajoModel.objects.filter(filtro).order_by("-fecha_actualizacion")


def excluir_egresados(qs, asignaciones):
    """Quita del queryset a quien su asignación PASIVO más reciente está EGRESADO."""
    return qs.annotate(
        **{CAMPO_ESTATUS_PASIVO: Subquery(asignaciones.values("estatusid__estatus")[:1])}
    ).exclude(**{f"{CAMPO_ESTATUS_PASIVO}__iexact": ESTATUS_EGRESADO})
