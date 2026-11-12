"""
Caso de uso: importar (o previsualizar) invitados de un evento.

La vista lee el archivo con el lector de infraestructura y delega aquí la
orquestación; el resultado es el mismo DTO que ya devolvía la API.
"""
from typing import Any

from apps.carnetizacion.application.dtos.evento_dtos import ResumenImportacionDTO
from apps.carnetizacion.application.use_cases.gestionar_invitados import (
    ImportarInvitadosUseCase,
)
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort


def importar_invitados(
    repo: RepoEventosPort,
    evento_id: str,
    filas_crudas: list[dict[str, Any]],
    *,
    aplicar: bool = False,
) -> ResumenImportacionDTO:
    """Valida las filas y, si `aplicar`, crea los invitados del evento."""
    return ImportarInvitadosUseCase(repo).ejecutar(
        evento_id, filas_crudas, aplicar=aplicar,
    )
