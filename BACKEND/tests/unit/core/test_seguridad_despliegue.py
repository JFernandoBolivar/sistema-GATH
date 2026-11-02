"""A-05: con TLS configurado, `check --deploy` no deja avisos de cookies/HSTS."""
import io

from django.core.management import call_command
from django.test import override_settings


@override_settings(
    DEBUG=False,
    SESSION_COOKIE_SECURE=True,
    CSRF_COOKIE_SECURE=True,
    SECURE_SSL_REDIRECT=True,
    SECURE_HSTS_SECONDS=31536000,
    SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
    ALLOWED_HOSTS=["gath.example.com"],
)
def test_check_deploy_sin_avisos_de_cookies_ssl_ni_hsts():
    salida = io.StringIO()
    try:
        call_command("check", deploy=True, stdout=salida, stderr=salida)
    except SystemExit:
        pass

    texto = salida.getvalue()
    for codigo in ("W004", "W008", "W012", "W016"):
        assert f"(security.{codigo})" not in texto, texto
