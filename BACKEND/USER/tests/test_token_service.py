"""
Caja blanca: TokenService.refresh_access_token con ROTATE_REFRESH_TOKENS=True.

Contexto del bug corregido (ver BACKEND/USER/services/token_service.py):
Antes del fix, la rama de rotacion llamaba
    RefreshToken.for_user(refresh.payload.get('user_id'))
pasando el user_id crudo (int) extraido del payload del JWT, en vez de una
instancia del modelo `cuenta`. `RefreshToken.for_user` (instalado:
djangorestframework-simplejwt 5.5.1, rest_framework_simplejwt/tokens.py:227)
hace `getattr(user, api_settings.USER_ID_FIELD)` es decir `getattr(user, 'id')`
sobre ese valor. Un `int` no tiene atributo `.id`, por lo que se lanzaba
`AttributeError` (no `TokenError`), sin capturar en refresh_access_token,
provocando un 500 no manejado en POST /api/accounts/refresh/ y forzando
logout en el frontend. El fix reemplaza esa linea por
`cuenta.objects.get(pk=refresh.payload.get('user_id'))` para resolver la
instancia real antes de invocar `RefreshToken.for_user`.

Estos tests corren contra la base de datos temporal `test_*` que crea el
test runner de Django (nunca la NUEVABD-GATH real) y verifican el
comportamiento correcto post-fix; no revierten el fix para hacer un control
negativo.
"""

from datetime import timedelta

from django.conf import settings
from django.test import TestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from RAC.models.personal_models import Employee, Sexo
from USER.models import cuenta, departaments, Rol
from USER.services.token_service import TokenService


class RefreshAccessTokenRotationTests(TestCase):
    """Cubre TokenService.refresh_access_token() con ROTATE_REFRESH_TOKENS=True
    y BLACKLIST_AFTER_ROTATION=True (configuracion real de SIGEP/settings.py)."""

    def setUp(self):
        self.sexo = Sexo.objects.create(sexo="FEMENINO")
        self.departamento = departaments.objects.create(
            nombre_departamento="TALENTO HUMANO"
        )
        self.rol = Rol.objects.create(nombre_rol="ADMIN")

        self.employee = Employee.objects.create(
            cedulaidentidad="V-20202020",
            nombres="ANA",
            apellidos="GOMEZ",
            sexoid=self.sexo,
        )
        self.user = cuenta.objects.create_user(
            cedula=self.employee,
            password="clave-segura-123",
            departamento=self.departamento,
            rol=self.rol,
        )

        # Mismo camino que login_view (USER/views/user_views.py:69):
        # el token inicial se genera con TokenService.generate_tokens_for_user.
        initial_tokens = TokenService.generate_tokens_for_user(self.user)
        self.old_refresh_str = initial_tokens["refresh"]
        self.old_access_str = initial_tokens["access"]

    # ------------------------------------------------------------------
    # Configuracion SIMPLE_JWT (settings.py)
    # ------------------------------------------------------------------
    def test_rotate_and_blacklist_settings_enabled(self):
        self.assertTrue(settings.SIMPLE_JWT["ROTATE_REFRESH_TOKENS"])
        self.assertTrue(settings.SIMPLE_JWT["BLACKLIST_AFTER_ROTATION"])

    def test_simple_jwt_token_lifetimes(self):
        self.assertEqual(
            settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"], timedelta(minutes=15)
        )
        self.assertEqual(
            settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"], timedelta(hours=8)
        )

    # ------------------------------------------------------------------
    # Caso principal: no debe lanzar excepcion y debe rotar correctamente
    # ------------------------------------------------------------------
    def test_refresh_access_token_does_not_raise_and_returns_valid_tokens(self):
        try:
            new_tokens = TokenService.refresh_access_token(self.old_refresh_str)
        except Exception as exc:  # pragma: no cover - solo para diagnostico claro
            self.fail(
                f"refresh_access_token() lanzo una excepcion inesperada: "
                f"{type(exc).__name__}: {exc}"
            )

        self.assertIn("access", new_tokens)
        self.assertIn("refresh", new_tokens)
        self.assertIsInstance(new_tokens["access"], str)
        self.assertIsInstance(new_tokens["refresh"], str)

        # Ambos tokens deben ser decodificables/validables (firma y claims OK)
        new_access = AccessToken(new_tokens["access"])
        new_refresh = RefreshToken(new_tokens["refresh"])

        self.assertEqual(str(new_access["user_id"]), str(self.user.id))
        self.assertEqual(str(new_refresh["user_id"]), str(self.user.id))
        self.assertEqual(new_access["user_id"], new_refresh["user_id"])

    def test_new_refresh_token_differs_from_old_one(self):
        new_tokens = TokenService.refresh_access_token(self.old_refresh_str)
        self.assertNotEqual(new_tokens["refresh"], self.old_refresh_str)

    # ------------------------------------------------------------------
    # Blacklist del refresh token viejo tras rotar
    # ------------------------------------------------------------------
    def test_old_refresh_token_is_blacklisted_after_rotation(self):
        old_refresh = RefreshToken(self.old_refresh_str)
        old_jti = old_refresh["jti"]
        outstanding = OutstandingToken.objects.get(jti=old_jti)

        self.assertFalse(
            BlacklistedToken.objects.filter(token=outstanding).exists(),
            "El token viejo no deberia estar blacklisteado antes de rotar",
        )

        TokenService.refresh_access_token(self.old_refresh_str)

        self.assertTrue(
            BlacklistedToken.objects.filter(token=outstanding).exists(),
            "El refresh token viejo debe quedar blacklisteado tras la rotacion",
        )

        # Reutilizar el token viejo (ya blacklisteado) debe fallar con TokenError
        with self.assertRaises(TokenError):
            TokenService.refresh_access_token(self.old_refresh_str)

    # ------------------------------------------------------------------
    # Rama de error: usuario referenciado por el token ya no existe
    # ------------------------------------------------------------------
    def test_refresh_access_token_raises_tokenerror_when_user_no_longer_exists(self):
        other_employee = Employee.objects.create(
            cedulaidentidad="V-30303030",
            nombres="LUIS",
            apellidos="PEREZ",
            sexoid=self.sexo,
        )
        other_user = cuenta.objects.create_user(
            cedula=other_employee, password="otra-clave-123"
        )
        tokens = TokenService.generate_tokens_for_user(other_user)

        other_user.delete()

        with self.assertRaises(TokenError):
            TokenService.refresh_access_token(tokens["refresh"])
