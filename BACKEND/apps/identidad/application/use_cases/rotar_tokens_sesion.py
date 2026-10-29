"""
Caso de uso `rotar_tokens_sesion` (refresco de sesión, R-11, corrige ALTA-08).

Corrige, para `apps.identidad`, el defecto real que sigue abierto en
`USER/services/token_service.py:119` (verificado en esta tarea, no solo
documentado):

    new_refresh = RefreshToken.for_user(refresh.payload.get('user_id'))

Ese código pasa el **entero** `user_id` del payload donde `RefreshToken.
for_user()` espera una instancia real de `AUTH_USER_MODEL` — con
`token_blacklist` instalado esto ni siquiera llega a fallar con
`AttributeError`: `for_user()` intenta *también* escribir la fila
`OutstandingToken` con `user=<ese entero>`, lo que revienta con `ValueError`
en la asignación de la FK (verificado en esta tarea). Además el rotado
**pierde los claims `cedula`/`rol`** y **no revalida `is_active`**: una
cuenta desactivada sigue renovando sesión hasta que su refresh expira (8 h).

Este caso de uso corrige las tres cosas: resuelve el titular real por el
puerto `RepoCuentaAuth`, revalida `is_active` (rechaza con
`PermissionDeniedError` si la cuenta ya no existe o fue desactivada) y
preserva los claims reemitiendo con `emitir_tokens_sesion`.
"""
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identidad.application.dtos.token_dto import TokensEmitidosDTO
from apps.identidad.application.use_cases.emitir_tokens_sesion import (
    emitir_tokens_sesion,
)
from apps.identidad.domain.ports.repo_cuenta_auth import RepoCuentaAuth
from core.domain.exceptions import PermissionDeniedError, ValidationError


def rotar_tokens_sesion(repo: RepoCuentaAuth, refresh_token_str: str) -> TokensEmitidosDTO:
    """Valida el refresh token vigente, revalida `is_active` y rota el par."""
    try:
        refresh_actual = RefreshToken(refresh_token_str)
    except TokenError as exc:
        raise ValidationError('El token de refresco es inválido o ha expirado.') from exc

    titular_id = refresh_actual.payload.get('user_id')
    titular = repo.obtener_titular_por_id(titular_id) if titular_id is not None else None

    if titular is None or not titular.is_active:
        raise PermissionDeniedError('La cuenta no existe o está inactiva.')

    if int(refresh_actual.payload.get('permisos_version', 1)) < titular.permisos_version:
        raise PermissionDeniedError(
            'Sus permisos cambiaron; inicie sesión nuevamente para aplicar los cambios.'
        )

    objeto_orm = repo.obtener_objeto_autenticable(titular_id)
    if objeto_orm is None:
        raise PermissionDeniedError('La cuenta no existe o está inactiva.')
    nuevos = emitir_tokens_sesion(
        objeto_orm, titular.cedula, titular.rol_nombre, titular.permisos_version
    )

    # Blacklist del token anterior (ROTATE_REFRESH_TOKENS/BLACKLIST_AFTER_ROTATION
    # de SIMPLE_JWT): un token ya usado no debe poder rotar de nuevo.
    try:
        refresh_actual.blacklist()
    except TokenError:
        pass

    return nuevos
