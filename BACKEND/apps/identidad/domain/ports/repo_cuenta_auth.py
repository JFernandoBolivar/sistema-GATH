"""
Puerto mínimo de autenticación de sesión (emisión/rotación de tokens, R-11).

Deliberadamente más angosto que `repo_cuentas.py` (gestión de usuarios): los
casos de uso de tokens (`emitir_tokens_sesion`, `rotar_tokens_sesion`) solo
necesitan resolver el titular de la sesión por su PK numérica (el `user_id`
embebido en el JWT), nunca el CRUD completo de cuentas.
"""
from typing import Protocol

from apps.identidad.domain.entities.titular_sesion import TitularSesion


class RepoCuentaAuth(Protocol):
    """Contrato de resolución del titular de una sesión JWT."""

    def obtener_titular_por_id(self, id: int) -> TitularSesion | None:
        """Titular de sesión (cédula, nombre de rol, estado) por su PK, o None."""
        ...

    def obtener_objeto_autenticable(self, id: int) -> object | None:
        """
        Instancia real del modelo `AUTH_USER_MODEL` (o `None`), exigida por
        `simplejwt.RefreshToken.for_user()`: con `token_blacklist` instalado,
        `for_user()` crea una fila `OutstandingToken` cuya FK `user` solo
        acepta esa clase concreta (verificado en esta tarea; ver docstring de
        `application/use_cases/emitir_tokens_sesion.py`). Su contenido nunca
        se inspecciona fuera de la emisión de tokens.
        """
        ...

    def obtener_cedula_por_email(self, correo: str) -> str | None:
        """Cédula de un empleado por su correo, o `None` si no existe (B7)."""
        ...

    def obtener_cuenta_por_correo(self, correo: str) -> object | None:
        """
        Cuenta autenticable por el correo exacto del empleado (sin distinguir
        mayúsculas), o `None` si no existe. El login es solo por correo: no se
        acepta cédula ni la parte local del correo. Devuelve la instancia del
        modelo con su rol precargado; es el único objeto que el flujo de login
        inspecciona para `check_password` / `is_active` / claims del rol.
        """
        ...
