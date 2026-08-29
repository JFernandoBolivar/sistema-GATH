"""
DTOs de Organización (Regla B5).
Estructuras inmutables para transportar datos entre capas.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DependenciaDTO:
    id: int
    codigo: str
    nombre: str


@dataclass(frozen=True)
class DireccionGeneralDTO:
    id: int
    codigo: str
    nombre: str
    dependencia_id: int | None = None


@dataclass(frozen=True)
class DireccionLineaDTO:
    id: int
    codigo: str
    nombre: str
    direccion_general_id: int | None = None


@dataclass(frozen=True)
class CoordinacionDTO:
    id: int
    codigo: str
    nombre: str
    direccion_linea_id: int | None = None
    direccion_general_id: int | None = None


@dataclass(frozen=True)
class OrganismoAdscritoDTO:
    id: int
    nombre: str
    parent_id: int | None = None
