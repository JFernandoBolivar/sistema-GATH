"""
Caso de uso `listar_direcciones_generales`.
"""
from apps.organizacion.application.dtos.organizacion_dtos import DireccionGeneralDTO
from apps.organizacion.domain.ports.repo_organizacion import RepoOrganizacion


def listar_direcciones_generales(
    repo: RepoOrganizacion, dependencia_id: int | None = None
) -> list[DireccionGeneralDTO]:
    entidades = repo.listar_direcciones_generales(dependencia_id)
    return [
        DireccionGeneralDTO(
            id=dg.id,
            codigo=dg.codigo,
            nombre=dg.nombre,
            dependencia_id=dg.dependencia_id,
        )
        for dg in entidades
    ]
