"""
DTOs de Carnetización (Regla B5).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CarnetDTO:
    id: int
    empleado_cedula: str
    empleado_nombres: str
    empleado_apellidos: str
    security_hash: str
    fecha_emision: str
    motivo_id: int
    motivo_nombre: str
    activo: bool
    observaciones: str | None = None


@dataclass(frozen=True)
class PlantillaCarnetDTO:
    id: int
    nombre: str
    imagen_url: str
    activo: bool
    creado: str


@dataclass(frozen=True)
class ValidacionCarnetDTO:
    es_valido: bool
    carnet: CarnetDTO | None = None
    mensaje: str = ""
