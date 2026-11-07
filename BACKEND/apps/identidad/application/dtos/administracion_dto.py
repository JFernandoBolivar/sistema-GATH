"""
DTOs de la administración de usuarios y de la matriz de permisos (D4).
"""
from dataclasses import dataclass, field

from apps.identidad.domain.entities.cuenta import Cuenta


@dataclass(frozen=True)
class PermisosUsuarioVista:
    """Permisos del rol, overrides y permiso efectivo (calculado en servidor)."""

    rol_id: int | None
    rol_nombre: str | None
    rol_nombre_visible: str | None
    del_rol: tuple[str, ...]
    allow: tuple[str, ...]
    deny: tuple[str, ...]
    efectivos: tuple[str, ...]
    version: int


@dataclass(frozen=True)
class DetalleUsuario:
    cuenta: Cuenta
    permisos: PermisosUsuarioVista


@dataclass(frozen=True)
class PaginaUsuarios:
    resultados: list[Cuenta]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


@dataclass(frozen=True)
class GuardarOverridesDTO:
    """Overrides individuales completos (allow/deny) y el motivo del cambio."""

    allow: tuple[str, ...] = field(default_factory=tuple)
    deny: tuple[str, ...] = field(default_factory=tuple)
    motivo: str = ''


@dataclass(frozen=True)
class GuardarMatrizDTO:
    """Conjunto completo de códigos de un rol y el motivo del cambio."""

    codigos: tuple[str, ...] = field(default_factory=tuple)
    motivo: str = ''


@dataclass(frozen=True)
class FilaMatriz:
    codigo: str
    nombre: str
    modulo: str


@dataclass(frozen=True)
class ColumnaRol:
    rol_id: int
    nombre: str
    nombre_visible: str
    codigos: tuple[str, ...]


@dataclass(frozen=True)
class MatrizPermisos:
    filas: list[FilaMatriz]
    roles: list[ColumnaRol]
