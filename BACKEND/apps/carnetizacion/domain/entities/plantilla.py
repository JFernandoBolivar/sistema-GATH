"""
Entidad de Dominio `PlantillaCarnet`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class PlantillaCarnet:
    id: int
    nombre: str
    imagen_url: str
    activo: bool
    creado: str
