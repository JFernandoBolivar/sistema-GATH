"""
Puerto del repositorio del catálogo de roles (CRUD, D-09/B21, CRIT-12).

No confundir con la matriz de permisos (`domain/ports/repo_permisos.py`):
este puerto administra el catálogo `Rol` legado (alta/edición/baja del
registro `nombre_rol`/`descripcion_rol`), no las concesiones de permisos.
Protocolo puro (regla B1); la implementación ORM vive en
`infrastructure/repositories/repo_roles_orm.py`.
"""
from typing import Protocol

from apps.identidad.domain.entities.rol import Rol


class RepoRoles(Protocol):
    """Contrato de alta, edición y baja del catálogo de roles."""

    def listar(self) -> list[Rol]:
        """Catálogo completo de roles."""
        ...

    def obtener_por_id(self, id: int) -> Rol | None:
        """Un rol del catálogo por su PK, o None si no existe."""
        ...

    def existe_nombre(self, nombre: str, excluir_id: int | None = None) -> bool:
        """¿Ya existe un rol con ese nombre (comparación insensible a mayúsculas)?"""
        ...

    def crear(self, nombre: str, descripcion: str) -> Rol:
        """Da de alta un rol nuevo en el catálogo."""
        ...

    def actualizar(self, id: int, nombre: str | None, descripcion: str | None) -> Rol:
        """Actualiza nombre y/o descripción de un rol existente."""
        ...

    def eliminar(self, id: int) -> None:
        """Elimina el rol. El llamador ya validó que no está en uso (CRIT-12)."""
        ...

    def contar_cuentas_con_rol(self, id: int) -> int:
        """Cuántas cuentas tienen asignado este rol (para el guardián de borrado, CRIT-12)."""
        ...
