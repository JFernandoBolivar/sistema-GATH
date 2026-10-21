"""
Caso de uso: Restablecer contraseña mediante token de recuperación (C-2, S4, S5).

Valida el token firmado, comprueba que la cuenta esté activa, que el token no haya
sido utilizado previamente (comparando el hash truncado), verifica la fortaleza de
la nueva contraseña, actualiza las credenciales e incrementa permisos_version
para revocar sesiones anteriores.
"""
from typing import Callable

from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.providers.validadores_password import (
    validar_fortaleza_django,
)
from apps.identidad.infrastructure.tokens.password_reset_token import (
    validar_token_recuperacion,
)
from core.domain.exceptions import ValidationError


def restablecer_password(
    token: str,
    password_nuevo: str,
    password_confirmacion: str,
    validar_token_fn: Callable[[str], tuple[int, str, str]] = validar_token_recuperacion,
    validar_fortaleza_fn: Callable[[str], None] = validar_fortaleza_django,
) -> str:
    """Valida el token y actualiza la contraseña de la cuenta."""
    if not password_nuevo or not password_confirmacion:
        raise ValidationError("Debe ingresar la nueva contraseña y su confirmación.")

    if password_nuevo != password_confirmacion:
        raise ValidationError("Las contraseñas ingresadas no coinciden.")

    cuenta_id, cedula, hash_slice = validar_token_fn(token)

    cuenta = CuentaModel.objects.select_related("cedula").filter(pk=cuenta_id).first()
    if not cuenta or not cuenta.is_active or str(cuenta.cedula_id) != str(cedula):
        raise ValidationError("La cuenta asociada al enlace no es válida o se encuentra inactiva.")

    # Protección anti-replay: si la contraseña ya fue cambiada, el hash no coincidirá
    if (cuenta.password or "")[:16] != hash_slice:
        raise ValidationError(
            "Este enlace de recuperación ya ha sido utilizado previamente o ha quedado invalidado."
        )

    # Validar fortaleza
    validar_fortaleza_fn(password_nuevo)

    # Establecer nueva contraseña y revocar sesiones activas anteriores
    cuenta.set_password(password_nuevo)
    cuenta.permisos_version = (cuenta.permisos_version or 0) + 1
    cuenta.save(update_fields=["password", "permisos_version"])

    return "Su contraseña ha sido restablecida exitosamente. Ya puede iniciar sesión con sus nuevas credenciales."
