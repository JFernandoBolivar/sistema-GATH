"""
Entidad de Dominio `OrganismoAdscrito`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class OrganismoAdscrito:
    id: int
    nombre: str
    parent_id: int | None = None
