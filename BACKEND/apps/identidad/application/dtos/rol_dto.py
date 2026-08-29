"""
DTOs del catálogo de roles (CRUD, CRIT-12).

Dataclasses inmutables de entrada de los casos de uso (regla B5).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CrearRolDTO:
    """Entrada de `crear_rol`."""

    nombre: str
    descripcion: str = ''


@dataclass(frozen=True)
class ActualizarRolDTO:
    """Entrada de `actualizar_rol`. `None` en un campo significa "no tocar"."""

    id: int
    nombre: str | None = None
    descripcion: str | None = None
