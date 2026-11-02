"""
Puerto del repositorio de permisos del módulo identidad (B3.1, D-09/B21).

Protocolo puro (regla B1): la implementación ORM vive en
`infrastructure/repositories/repo_permisos_orm.py` y los dobles de test en
memoria implementan este mismo contrato.
"""
from typing import Protocol

from apps.identidad.domain.entities.permiso import Permiso
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.entities.usuario_permisos import UsuarioPermisos


class RepoPermisos(Protocol):
    """Contrato de acceso al catálogo, roles y políticas efectivas de usuarios."""

    def listar(self) -> list[Permiso]:
        """Catálogo completo de permisos."""
        ...

    def obtener_por_codigo(self, codigo: str) -> Permiso | None:
        """Un permiso por su código `[modulo].[accion]`, o None."""
        ...

    def existe_codigo(self, codigo: str) -> bool:
        """¿El código está dado de alta en el catálogo?"""
        ...

    def permisos_del_rol(self, rol_id: int) -> tuple[Permiso, ...]:
        """Permisos concedidos a un rol legado por su PK."""
        ...

    def codigos_del_rol(self, rol_id: int) -> frozenset[str]:
        """Códigos efectivos de un rol legado por su PK."""
        ...

    def politica_del_rol(self, rol_id: int) -> PoliticaAcceso:
        """Política de acceso (allow/deny) asociada al rol."""
        ...

    def rol_de_cuenta(self, cedula: str) -> Rol | None:
        """Rol legado de la cuenta identificada por cédula."""
        ...

    def obtener_permisos_usuario(self, cedula: str) -> UsuarioPermisos | None:
        """
        Obtiene la configuración y política efectiva compilada del usuario
        (combinando su rol base + sus excepciones directas allow/deny).
        """
        ...

    def guardar_override_usuario(
        self,
        cedula: str,
        custom_allow: list[str] | frozenset[str],
        custom_deny: list[str] | frozenset[str],
    ) -> UsuarioPermisos:
        """
        Registra o actualiza excepciones personalizadas para un usuario,
        recompila su política efectiva e incrementa la versión de permisos.
        """
        ...

