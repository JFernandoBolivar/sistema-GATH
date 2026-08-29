"""
Caso de uso `listar_dependencias` (Regla B4/B21).
Puro, sin dependencias de Django/DRF.
"""
from apps.organizacion.application.dtos.organizacion_dtos import DependenciaDTO
from apps.organizacion.domain.ports.repo_organizacion import RepoOrganizacion


def listar_dependencias(repo: RepoOrganizacion) -> list[DependenciaDTO]:
    entidades = repo.listar_dependencias()
    return [
        DependenciaDTO(
            id=d.id,
            codigo=d.codigo,
            nombre=d.nombre,
        )
        for d in entidades
    ]
