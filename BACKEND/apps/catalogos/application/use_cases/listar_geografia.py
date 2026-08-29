"""
Casos de uso para consulta geográfica (Regla B4/B21).
"""
from apps.catalogos.application.dtos.catalogos_dtos import (
    EstadoDTO,
    MunicipioDTO,
    ParroquiaDTO,
    RegionDTO,
)
from apps.catalogos.domain.ports.repo_catalogos import RepoCatalogos


def listar_regiones(repo: RepoCatalogos) -> list[RegionDTO]:
    return [RegionDTO(id=r.id, nombre=r.nombre) for r in repo.listar_regiones()]


def listar_estados(repo: RepoCatalogos, region_id: int | None = None) -> list[EstadoDTO]:
    return [
        EstadoDTO(id=e.id, nombre=e.nombre, region_id=e.region_id)
        for e in repo.listar_estados(region_id)
    ]


def listar_municipios(repo: RepoCatalogos, estado_id: int | None = None) -> list[MunicipioDTO]:
    return [
        MunicipioDTO(id=m.id, nombre=m.nombre, estado_id=m.estado_id)
        for m in repo.listar_municipios(estado_id)
    ]


def listar_parroquias(repo: RepoCatalogos, municipio_id: int | None = None) -> list[ParroquiaDTO]:
    return [
        ParroquiaDTO(id=p.id, nombre=p.nombre, municipio_id=p.municipio_id)
        for p in repo.listar_parroquias(municipio_id)
    ]
