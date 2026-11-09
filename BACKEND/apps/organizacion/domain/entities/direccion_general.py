"""
Entidad de Dominio `DireccionGeneral`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DireccionGeneral:
    id: int
    codigo: str
    nombre: str
    dependencia_id: int | None = None
