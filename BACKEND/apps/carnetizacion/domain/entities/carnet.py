"""
Entidad de Dominio `Carnet` (Regla B1, O44 - E3).
"""
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Carnet:
    id: int
    empleado_cedula: str
    empleado_nombres: str
    empleado_apellidos: str
    security_hash: str
    fecha_emision: str
    motivo_id: int
    motivo_nombre: str
    activo: bool = True
    observaciones: str | None = None
    plantilla_id: str | int | None = None
    plantilla_version: int | None = None
    plantilla_snapshot: dict[str, Any] | None = None
