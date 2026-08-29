"""
Entidad de Dominio `Carnet` (Regla B1).
"""
from dataclasses import dataclass


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
