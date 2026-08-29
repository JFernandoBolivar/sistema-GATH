"""
Entidad `Departamento` del dominio de identidad (catálogo administrativo).

Metadato organizacional simple (B9.3.5: el departamento no participa en la
autorización, solo es informativo). Pura e inmutable (B1, B5).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Departamento:
    """Departamento administrativo al que puede adscribirse una cuenta."""

    id: int
    nombre: str
    descripcion: str = ''
