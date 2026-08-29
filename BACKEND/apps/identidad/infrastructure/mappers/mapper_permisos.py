"""
Mappers ORM ↔ entidad de dominio del módulo identidad (B3.1).

Funciones puras `a_entidad()`: las filas del ORM nunca cruzan hacia las capas
internas (regla B6).
"""
from typing import Iterable

from apps.identidad.domain.entities.permiso import Permiso
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.value_objects.codigo_permiso import CodigoPermiso
from apps.identidad.infrastructure.models.permiso_model import PermisoModel


def permiso_a_entidad(fila: PermisoModel) -> Permiso:
    """Convierte una fila `identidad_permiso` en la entidad `Permiso`."""
    return Permiso(codigo=CodigoPermiso(fila.codigo), nombre=fila.nombre)


def rol_a_entidad(
    rol_id: int, nombre: str, filas: Iterable[PermisoModel]
) -> Rol:
    """
    Reconstruye el agregado `Rol`: identificador legado + matriz de permisos
    a partir de las filas de la matriz ya filtradas por rol.
    """
    return Rol(
        identificador=int(rol_id),
        nombre=nombre,
        descripcion='',
        permisos=tuple(permiso_a_entidad(f) for f in filas),
    )
