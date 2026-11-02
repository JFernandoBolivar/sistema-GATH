"""
Entidad de Dominio `DenominacionEspecifica`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DenominacionEspecifica:
    id: int
    nombre: str
    orden: int = 30
