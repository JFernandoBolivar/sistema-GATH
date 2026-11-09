"""
Entidades de Dominio Geográficas (Puras inmutables, Regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Region:
    id: int
    nombre: str


@dataclass(frozen=True)
class Estado:
    id: int
    nombre: str
    region_id: int | None = None


@dataclass(frozen=True)
class Municipio:
    id: int
    nombre: str
    estado_id: int


@dataclass(frozen=True)
class Parroquia:
    id: int
    nombre: str
    municipio_id: int
