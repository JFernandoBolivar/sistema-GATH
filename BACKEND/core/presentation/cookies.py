"""
Helpers de cookies JWT HttpOnly (B2.17, Contrato C-2).

R-10 CERRADO (BITACORA_RECONSTRUCCION.md, Entrada #035): `GATH/settings.py` y
`GATH/settings.py` declaran ahora `SIMPLE_JWT['AUTH_COOKIE'] = 'dj_access'` /
`AUTH_COOKIE_REFRESH = 'dj_refresh'`, alineados con el Contrato C-2 y con el
frontend (`NextJS/src/lib/api-client.ts`,
`NextJS/src/shared/infrastructure/http/fetcher-api.ts`). Estos helpers siguen
leyendo el nombre desde `settings.SIMPLE_JWT` (única fuente de verdad): no
hace falta tocarlos de nuevo si el nombre cambia otra vez, solo el setting.
Los valores por defecto de `.get(..., default)` de abajo solo se usarían si
esas claves llegaran a faltar del dict; se mantienen sincronizados con el
valor vigente por prolijidad, no porque el código dependa de ellos hoy.
"""
from django.conf import settings
from rest_framework.response import Response


def _config() -> dict:
    return settings.SIMPLE_JWT


def set_jwt_cookies(response: Response, access: str, refresh: str) -> Response:
    """Fija las cookies de acceso y refresco con los flags HttpOnly/Secure/SameSite (C-2)."""
    jwt_config = _config()

    response.set_cookie(
        key=jwt_config.get('AUTH_COOKIE', 'dj_access'),
        value=access,
        httponly=jwt_config.get('AUTH_COOKIE_HTTP_ONLY', True),
        secure=jwt_config.get('AUTH_COOKIE_SECURE', True),
        samesite=jwt_config.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        path=jwt_config.get('AUTH_COOKIE_PATH', '/'),
        max_age=int(jwt_config['ACCESS_TOKEN_LIFETIME'].total_seconds()),
    )
    response.set_cookie(
        key=jwt_config.get('AUTH_COOKIE_REFRESH', 'dj_refresh'),
        value=refresh,
        httponly=jwt_config.get('AUTH_COOKIE_HTTP_ONLY', True),
        secure=jwt_config.get('AUTH_COOKIE_SECURE', True),
        samesite=jwt_config.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        path=jwt_config.get('AUTH_COOKIE_PATH', '/'),
        max_age=int(jwt_config['REFRESH_TOKEN_LIFETIME'].total_seconds()),
    )
    return response


def clear_jwt_cookies(response: Response) -> Response:
    """Elimina ambas cookies JWT (logout)."""
    jwt_config = _config()

    response.delete_cookie(
        key=jwt_config.get('AUTH_COOKIE', 'dj_access'),
        path=jwt_config.get('AUTH_COOKIE_PATH', '/'),
    )
    response.delete_cookie(
        key=jwt_config.get('AUTH_COOKIE_REFRESH', 'dj_refresh'),
        path=jwt_config.get('AUTH_COOKIE_PATH', '/'),
    )
    return response
