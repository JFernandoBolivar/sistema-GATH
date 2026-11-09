"""Puerto de lectura del catálogo configurable de tipos de soporte (O41)."""
from __future__ import annotations

from typing import Protocol, Sequence

from core.domain.tipos_soporte import ChecklistSoporteConfigurado, TipoSoporteConfigurado


class RepoSoporteConfiguracion(Protocol):
    """Configuración de tipos de documento y checklist por sección (solo lectura)."""

    def listar_tipos(self) -> Sequence[TipoSoporteConfigurado]:
        ...

    def listar_checklist(self) -> Sequence[ChecklistSoporteConfigurado]:
        ...

    def checklist_de_seccion(self, seccion: str) -> Sequence[ChecklistSoporteConfigurado]:
        ...
