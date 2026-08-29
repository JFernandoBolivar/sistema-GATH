"""
DTOs de catálogos de soporte (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CatalogoItemDTO:
    id: int
    nombre: str
    codigo: str | None = None
    extra: dict = field(default_factory=dict)


@dataclass(frozen=True)
class CodigoPostalDTO:
    id: int
    nombre: str
    estado_id: int
