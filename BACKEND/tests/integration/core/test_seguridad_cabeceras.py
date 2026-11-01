"""E4: cabeceras de seguridad, cookies/CSRF y controles de acceso en endpoints críticos."""
import pytest
from django.conf import settings
from rest_framework.response import Response
from rest_framework.test import APIClient

from core.presentation.cookies import set_jwt_cookies

pytestmark = pytest.mark.django_db


def test_cabeceras_de_seguridad_en_respuesta_api():
    respuesta = APIClient().get('/api/v1/identidad/auth/me/')
    assert respuesta.status_code in (401, 403)
    assert respuesta.headers['X-Content-Type-Options'] == 'nosniff'
    assert respuesta.headers['X-Frame-Options'] == 'DENY'
    assert respuesta.headers['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert 'camera=()' in respuesta.headers['Permissions-Policy']
    assert respuesta.headers['Content-Security-Policy'].startswith("default-src 'none'")
    assert 'unsafe-inline' not in respuesta.headers['Content-Security-Policy']


def test_csrf_middleware_activo():
    assert 'django.middleware.csrf.CsrfViewMiddleware' in settings.MIDDLEWARE


def test_cookies_de_sesion_son_httponly_y_samesite_lax():
    """Las cookies JWT son HttpOnly y SameSite=Lax: un POST cross-site no las envía."""
    response = set_jwt_cookies(Response(), 'acceso', 'refresco')
    cookies = {cookie.key: cookie for cookie in response.cookies.values()}
    acceso = cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]
    refresco = cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]
    for cookie in (acceso, refresco):
        assert cookie['httponly'] is True
        assert cookie['samesite'] == 'Lax'


def test_login_sin_credenciales_validas_no_emite_cookies_de_sesion():
    respuesta = APIClient().post(
        '/api/v1/identidad/auth/login/',
        {'correo': 'nadie@ejemplo.com', 'password': 'x'},
        format='json',
    )
    assert respuesta.status_code == 401
    assert settings.SIMPLE_JWT['AUTH_COOKIE'] not in respuesta.cookies


def test_endpoint_de_usuarios_sin_sesion_no_filtra_datos():
    respuesta = APIClient().get('/api/v1/identidad/usuarios/')
    assert respuesta.status_code in (401, 403)
    cuerpo = respuesta.json()
    datos = cuerpo.get('data') or {}
    assert 'results' not in datos
