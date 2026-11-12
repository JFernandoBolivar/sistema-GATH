"""Sugerencias reales para las reglas de color del diseñador (cargo y oficina)."""
from typing import Any

from core.domain.catalogos import ESTATUS_ACTIVO
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.carnetizacion.domain.services.resolver_color import normalizar_clave

from .repo_carnetizacion_comun import cargo_y_departamento


class RepoSugerenciasColorMixin:
    def sugerencias_reglas_color(self) -> dict[str, list[str]]:
        """Cargos y oficinas del **último** cargo activo de cada titular.

        Se toma la asignación más reciente de cada empleado (igual que el PDF)
        y solo se incluye si ese último cargo está ACTIVO. Así cada valor
        sugerido es exactamente el texto que el PDF pondría en `datos.cargo` /
        `datos.departamento`. Se deduplica con la misma normalización que usa
        `resolver_color_carnet` (acentos, mayúsculas, espacios y guiones), para
        que dos variantes no creen dos reglas que resuelven igual.
        """
        asignaciones = (
            AsigTrabajoModel.objects
            .filter(employee__isnull=False)
            .select_related('denominacioncargoid', 'DireccionGeneral', 'estatusid')
            .order_by('employee_id', '-fecha_actualizacion')
        )
        ultima_por_titular: dict[Any, Any] = {}
        for asignacion in asignaciones.iterator():
            ultima_por_titular.setdefault(asignacion.employee_id, asignacion)

        cargos: dict[str, str] = {}
        oficinas: dict[str, str] = {}
        for asignacion in ultima_por_titular.values():
            estatus = getattr(asignacion.estatusid, 'estatus', '') or ''
            if estatus.strip().upper() != ESTATUS_ACTIVO:
                continue
            cargo, departamento = cargo_y_departamento(asignacion)
            for valor, destino in (
                ((cargo or '').strip(), cargos),
                ((departamento or '').strip(), oficinas),
            ):
                clave = normalizar_clave(valor)
                if clave:
                    destino.setdefault(clave, valor.upper())

        return {
            'cargos': sorted(cargos.values()),
            'oficinas': sorted(oficinas.values()),
        }
