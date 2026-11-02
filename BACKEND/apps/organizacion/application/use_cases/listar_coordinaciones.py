"""
Caso de uso `listar_coordinaciones`.
"""
from apps.organizacion.application.dtos.organizacion_dtos import CoordinacionDTO
from apps.organizacion.domain.ports.repo_organizacion import RepoOrganizacion


def listar_coordinaciones(
    repo: RepoOrganizacion,
    direccion_linea_id: int | None = None,
) -> list[CoordinacionDTO]:
    entidades = repo.listar_coordinaciones(direccion_linea_id=direccion_linea_id)
    return [
        CoordinacionDTO(
            id=c.id,
            codigo=c.codigo,
            nombre=c.nombre,
            direccion_linea_id=c.direccion_linea_id,
        )
        for c in entidades
    ]
