"""
DTOs del catálogo de roles (CRUD, CRIT-12; O43).

Dataclasses inmutables de entrada de los casos de uso (regla B5). El código
interno del rol (`nombre_rol`) lo genera el sistema al crear y no se edita.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CrearRolDTO:
    """Entrada de `crear_rol`: el usuario escribe solo el nombre visible."""

    nombre_visible: str
    descripcion: str = ''


@dataclass(frozen=True)
class ActualizarRolDTO:
    """Entrada de `actualizar_rol`. `None` en un campo significa "no tocar".

    `codigo` solo existe para rechazar un intento de cambiar el código interno.
    """

    id: int
    nombre_visible: str | None = None
    descripcion: str | None = None
    codigo: str | None = None
