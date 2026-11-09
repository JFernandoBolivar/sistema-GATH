"""
Entidad de Dominio `Dependencia`.

Representa una dependencia u organismo principal en el organigrama institucional.
Pura inmutable sin dependencias de frameworks (Regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Dependencia:
    id: int
    codigo: str
    nombre: str
