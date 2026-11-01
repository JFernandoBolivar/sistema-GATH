"""
Autenticación JWT por Header Bearer y Cookie HttpOnly (Reglas B1.3, B26).
"""
from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings

from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM


class CookieJWTAuthentication(JWTAuthentication):
    """
    Permite autenticar tanto por header `Authorization: Bearer <token>`
    como por cookie segura.

    R-10 (BITACORA_RECONSTRUCCION.md, Entradas #033/#035): el nombre de la
    cookie se resuelve desde `settings.SIMPLE_JWT['AUTH_COOKIE']` — única
    fuente de verdad, la misma que usa `USER/authentication.py` (legado) y
    `core/presentation/cookies.py` — en vez de un literal hardcodeado, para
    que un cambio de nombre no requiera tocar esta clase.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'dj_access')
            raw_token = request.COOKIES.get(cookie_name)
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

    def get_user(self, validated_token):
        """
        Además de validar firma y vigencia, rechaza el token si la versión de
        permisos de la cuenta (claim `permisos_version`) quedó atrás: cambió su
        rol, sus ajustes individuales o su contraseña (Etapa A4). Un token sin
        el claim (emitido antes de A4) cuenta como versión 1.

        La cuenta se carga una sola vez, anotada con la versión de permisos y la
        condición del trabajador (A-02), y `request.user` la reutiliza en
        `/auth/me` para no repetir la consulta.
        """
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        user = (
            RepoCuentasORM().obtener_modelo_contexto_sesion(user_id)
            if user_id
            else None
        )
        if user is None:
            raise AuthenticationFailed('Usuario no encontrado.', code='user_not_found')
        if api_settings.CHECK_USER_IS_ACTIVE and not user.is_active:
            raise AuthenticationFailed('Usuario inactivo o deshabilitado.', code='user_inactive')

        version_token = int(validated_token.payload.get('permisos_version', 1))
        if version_token < (getattr(user, 'permisos_version', None) or 1):
            raise InvalidToken('La sesión fue invalidada por un cambio de permisos.')
        # Marca para que `MeView` reutilice esta fila ya consultada.
        user._gath_contexto_sesion = True
        return user
