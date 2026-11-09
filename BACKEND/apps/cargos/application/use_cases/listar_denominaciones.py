"""
Casos de uso para listar denominaciones de cargos.
"""
from apps.cargos.application.dtos.cargos_dtos import DenominacionDTO
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def listar_denominaciones(repo: RepoCargos) -> list[DenominacionDTO]:
    return [
        DenominacionDTO(id=d.id, nombre=d.nombre, orden=d.orden)
        for d in repo.listar_denominaciones()
    ]


def listar_denominaciones_especificas(repo: RepoCargos) -> list[DenominacionDTO]:
    return [
        DenominacionDTO(id=d.id, nombre=d.nombre, orden=d.orden)
        for d in repo.listar_denominaciones_especificas()
    ]
