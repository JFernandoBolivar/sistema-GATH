"""
Caso de uso `listar_direcciones_linea`.
"""
from apps.organizacion.application.dtos.organizacion_dtos import DireccionLineaDTO
from apps.organizacion.domain.ports.repo_organizacion import RepoOrganizacion


def listar_direcciones_linea(
    repo: RepoOrganizacion, direccion_general_id: int | None = None
) -> list[DireccionLineaDTO]:
    entidades = repo.listar_direcciones_linea(direccion_general_id)
    return [
        DireccionLineaDTO(
            id=dl.id,
            codigo=dl.codigo,
            nombre=dl.nombre,
            direccion_general_id=dl.direccion_general_id,
        )
        for dl in entidades
    ]
