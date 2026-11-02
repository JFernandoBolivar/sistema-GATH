"""
Puerto de la versión de permisos por cuenta (invalidación de sesiones, Etapa A4).

`USER_cuenta` es legada (sin ALTER), así que la versión vive en una tabla propia.
La versión sube cuando cambia el rol de la cuenta, sus ajustes individuales, la
matriz del rol o su contraseña; los JWT emitidos con una versión menor se rechazan.
"""
from typing import Protocol


class RepoPermisosVersion(Protocol):
    def obtener(self, cuenta_id: int) -> int:
        """Versión vigente (1 si la cuenta nunca cambió)."""
        ...

    def incrementar_cuenta(self, cuenta_id: int) -> int:
        """Sube la versión de una cuenta y devuelve la nueva."""
        ...

    def incrementar_por_cedula(self, cedula: str) -> int | None:
        """Igual que `incrementar_cuenta`, resolviendo la cuenta por cédula (None si no existe)."""
        ...

    def incrementar_por_rol(self, rol_id: int) -> int:
        """Sube la versión de todas las cuentas con ese rol; devuelve cuántas."""
        ...
