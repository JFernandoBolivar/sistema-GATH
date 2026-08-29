"""
Caso de uso `cerrar_sesion` (logout, R-11).

Réplica del comportamiento de `USER/views/user_views.py::logout_view`: el
refresh token se blacklistea si está presente y es válido, pero el logout
**nunca falla** por eso — un token ya expirado o corrupto no debe impedirle
al usuario cerrar sesión (las cookies se limpian siempre desde la vista,
sin importar el resultado de este caso de uso).
"""
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


def cerrar_sesion(refresh_token_str: str | None) -> bool:
    """Blacklistea el refresh token. Devuelve False si no había o era inválido."""
    if not refresh_token_str:
        return False
    try:
        RefreshToken(refresh_token_str).blacklist()
        return True
    except TokenError:
        return False
