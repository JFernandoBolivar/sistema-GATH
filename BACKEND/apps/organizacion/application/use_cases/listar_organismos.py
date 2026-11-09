"""
Caso de uso `listar_organismos_adscritos`.
"""
from apps.organizacion.application.dtos.organizacion_dtos import OrganismoAdscritoDTO
from apps.organizacion.domain.ports.repo_organizacion import RepoOrganizacion


def listar_organismos_adscritos(
    repo: RepoOrganizacion,
) -> list[OrganismoAdscritoDTO]:
    entidades = repo.listar_organismos_adscritos()
    return [
        OrganismoAdscritoDTO(
            id=o.id,
            nombre=o.nombre,
            parent_id=o.parent_id,
        )
        for o in entidades
    ]
