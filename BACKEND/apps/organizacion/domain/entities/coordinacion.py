"""
Entidad de Dominio `Coordinacion`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Coordinacion:
    id: int
    codigo: str
    nombre: str
    direccion_linea_id: int | None = None
