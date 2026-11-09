"""
Puerto del repositorio del flujo de recuperación de contraseña (D-09/B21).

Protocolo puro (B1): la implementación ORM vive en
`infrastructure/repositories/repo_recuperacion_password_orm.py`.
"""
from typing import Protocol

from apps.identidad.domain.entities.cuenta_recuperacion import CuentaRecuperacion


class RepoRecuperacionPassword(Protocol):
    def buscar_activa_por_identificador(self, identificador: str) -> CuentaRecuperacion | None:
        """Cuenta activa por correo institucional (si contiene '@') o por cédula."""
        ...

    def obtener_por_id(self, cuenta_id: int) -> CuentaRecuperacion | None:
        ...

    def restablecer_password(self, cuenta_id: int, password_nuevo: str) -> None:
        """Fija la nueva contraseña e incrementa `permisos_version` (revoca las sesiones activas)."""
        ...
