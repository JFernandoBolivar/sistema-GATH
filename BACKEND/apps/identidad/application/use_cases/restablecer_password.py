"""
Caso de uso: Restablecer contraseña mediante token de recuperación (C-2, S4, S5).

Valida el token firmado, comprueba que la cuenta esté activa, que el token no haya
sido utilizado previamente (comparando el hash truncado), verifica la fortaleza de
la nueva contraseña, actualiza las credenciales e incrementa permisos_version
para revocar sesiones anteriores.

Puro (B4): el repositorio, el validador del token y el de fortaleza se inyectan;
los adaptadores reales los cablea la vista.
"""
from typing import Callable

from apps.identidad.domain.events import EventoIdentidad, MotivoCambioPassword, TipoEventoIdentidad
from apps.identidad.domain.ports.repo_recuperacion_password import RepoRecuperacionPassword
from core.domain.exceptions import ValidationError


def restablecer_password(
    repo: RepoRecuperacionPassword,
    token: str,
    password_nuevo: str,
    password_confirmacion: str,
    validar_token_fn: Callable[[str], tuple[int, str, str]],
    validar_fortaleza_fn: Callable[[str], None],
    publicar: Callable[[EventoIdentidad], None] | None = None,
) -> str:
    """Valida el token y actualiza la contraseña de la cuenta."""
    if not password_nuevo or not password_confirmacion:
        raise ValidationError("Debe ingresar la nueva contraseña y su confirmación.")

    if password_nuevo != password_confirmacion:
        raise ValidationError("Las contraseñas ingresadas no coinciden.")

    cuenta_id, cedula, hash_slice = validar_token_fn(token)

    cuenta = repo.obtener_por_id(cuenta_id)
    if not cuenta or not cuenta.activa or cuenta.cedula != str(cedula):
        raise ValidationError("La cuenta asociada al enlace no es válida o se encuentra inactiva.")

    # Protección anti-replay: si la contraseña ya fue cambiada, el hash no coincidirá
    if cuenta.password_hash[:16] != hash_slice:
        raise ValidationError(
            "Este enlace de recuperación ya ha sido utilizado previamente o ha quedado invalidado."
        )

    validar_fortaleza_fn(password_nuevo)

    repo.restablecer_password(cuenta.id, password_nuevo)
    if publicar is not None:
        publicar(EventoIdentidad(
            tipo=TipoEventoIdentidad.PASSWORD_CAMBIADA, cedula=cuenta.cedula,
            motivo=MotivoCambioPassword.ENLACE.value,
        ))

    return "Su contraseña ha sido restablecida exitosamente. Ya puede iniciar sesión con sus nuevas credenciales."
