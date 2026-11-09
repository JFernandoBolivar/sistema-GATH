"""Puerto del repositorio de auditoría (solo lectura)."""
from typing import Protocol

from apps.auditoria.domain.entities.registro import (
    IncidenteSeguridad,
    OpcionesAuditoria,
    RegistroAuditoria,
)
from apps.auditoria.domain.value_objects.filtros_auditoria import FiltrosAuditoria


class RepoAuditoria(Protocol):
    def listar(
        self, filtros: FiltrosAuditoria, limite: int, offset: int = 0
    ) -> tuple[list[RegistroAuditoria], int]: ...

    def obtener(self, id: str) -> RegistroAuditoria | None: ...

    def opciones(self) -> OpcionesAuditoria: ...

    def listar_incidentes(
        self, filtros: FiltrosAuditoria, limite: int, offset: int = 0
    ) -> tuple[list[IncidenteSeguridad], int]: ...
