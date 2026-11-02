"""
Entidad de Dominio `DenominacionCargo` (Regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DenominacionCargo:
    id: int
    nombre: str
    orden: int = 30
