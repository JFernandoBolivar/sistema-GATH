"""
Autenticación JWT por Header Bearer y Cookie HttpOnly (Reglas B1.3, B26).
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


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
