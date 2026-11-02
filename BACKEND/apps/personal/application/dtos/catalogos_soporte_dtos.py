"""
DTOs de catálogos de soporte (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CatalogoItemDTO:
    id: int
    nombre: str
    codigo: str | None = None
    categoria_id: int | None = None
    categoria_nombre: str | None = None
    tipo_prenda_id: int | None = None
    tipo_prenda_nombre: str | None = None
    region_id: int | None = None
    region_codigo: str | None = None
    region_descripcion: str | None = None
    extra: dict = field(default_factory=dict)


@dataclass(frozen=True)
class CodigoPostalDTO:
    id: int
    nombre: str
    estado_id: int
