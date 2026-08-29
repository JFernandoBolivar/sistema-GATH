"""
Puerto del repositorio de cuentas de usuario (gestión de usuarios, D-09/B21).

Protocolo puro (regla B1): la implementación ORM vive en
`infrastructure/repositories/repo_cuentas_orm.py` y los dobles de test en
memoria implementan este mismo contrato (tests/unit/identidad).
"""
from typing import Protocol

from apps.identidad.domain.entities.cuenta import Cuenta


class RepoCuentas(Protocol):
    """Contrato de alta, edición, listado y cambio de contraseña de cuentas."""

    def obtener_por_id(self, id: int) -> Cuenta | None:
        """Una cuenta por su PK, o None si no existe."""
        ...

    def existe_cuenta_para_cedula(self, cedula: str) -> bool:
        """¿Ya existe una cuenta de acceso para esta cédula de empleado?"""
        ...

    def listar(self, filtros: dict) -> list[Cuenta]:
        """Cuentas que cumplen los filtros primitivos (departamento_id, rol_id, is_active, cedula)."""
        ...

    def crear(self, cedula: str, password: str, departamento_id: int | None, rol_id: int | None) -> Cuenta:
        """Da de alta una cuenta nueva para la cédula indicada."""
        ...

    def guardar(self, cuenta: Cuenta) -> Cuenta:
        """Persiste los cambios de departamento/rol/estado de una cuenta existente."""
        ...

    def verificar_password(self, id: int, password_plano: str) -> bool:
        """¿La contraseña en texto plano coincide con la almacenada (hash)?"""
        ...

    def establecer_password(self, id: int, password_nuevo: str) -> None:
        """Reemplaza el hash de contraseña almacenado."""
        ...
