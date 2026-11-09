"""
Entidad de Dominio `DireccionLinea`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DireccionLinea:
    id: int
    codigo: str
    nombre: str
    direccion_general_id: int | None = None
