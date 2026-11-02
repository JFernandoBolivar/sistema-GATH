"""
DTOs de Catálogos (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CatalogoItemDTO:
    id: int
    nombre: str
    codigo: str | None = None
    extra: dict = field(default_factory=dict)


@dataclass(frozen=True)
class RegionDTO:
    id: int
    nombre: str


@dataclass(frozen=True)
class EstadoDTO:
    id: int
    nombre: str
    region_id: int | None = None


@dataclass(frozen=True)
class MunicipioDTO:
    id: int
    nombre: str
    estado_id: int


@dataclass(frozen=True)
class ParroquiaDTO:
    id: int
    nombre: str
    municipio_id: int
