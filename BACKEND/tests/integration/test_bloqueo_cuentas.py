"""
Suite de integración del bloqueo progresivo de cuentas — B3.12 / B3.14 (cierre).

Ejercita el endpoint real de login (`POST /api/v1/identidad/auth/login/`)
contra PostgreSQL, con la caché de throttling AISLADA en LocMemCache vía
`override_settings` — exigencia de B3.14: ningún contador toca la tabla
DatabaseCache real ni arrastra estado entre corridas.
"""
import copy
import logging

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.identidad.infrastructure.models.intento_fallido_model import (
    IntentoFallidoModel,
)
from apps.identidad.infrastructure.repositories.repo_bloqueos_cache_db import (
    PREFIJO_CLAVE,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.catalogos.infrastructure.models.catalogo_models import SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel

URL_LOGIN = '/api/v1/identidad/auth/login/'
PASSWORD = 'Clave*Segura1'
CORREO = 'maria.prueba@conatel.gob'


@pytest.fixture(autouse=True)
def aislar_cache_throttling(settings):
    """B3.14: caché aislada por test (LocMemCache); nunca la DatabaseCache."""
    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'test-bloqueos',
        }
    }
    cache.clear()


@pytest.fixture(autouse=True)
def ampliar_throttle_drf(settings):
    """El ScopedRateThrottle 'login' (5/min por IP, B0.10) es otra capa
    independiente; se amplía su tasa para que solo se ejerza el bloqueo
    progresivo bajo prueba (B3.12)."""
    configuracion = copy.deepcopy(settings.REST_FRAMEWORK)
    configuracion['DEFAULT_THROTTLE_RATES']['login'] = '1000/min'
    settings.REST_FRAMEWORK = configuracion


@pytest.fixture
def capturar_security_backend():
    """Handler propio sobre el logger 'security_backend' (propagate=False en
    settings.LOGGING): permite asertar la línea del incidente sin depender del
    archivo TXT rotado."""
    registros = []

    class _Captura(logging.Handler):
        def emit(self, record):
            registros.append(record.getMessage())

    handler = _Captura(level=logging.INFO)
    logger = logging.getLogger('security_backend')
    logger.addHandler(handler)
    yield registros
    logger.removeHandler(handler)


@pytest.fixture
def cuenta_login(db):
    """Cuenta real de acceso (Employee + CuentaModel) bajo arquitectura Onion."""
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    empleado, _ = EmployeeModel.objects.get_or_create(
        cedulaidentidad='20111234',
        defaults={
            'nombres': 'María',
            'apellidos': 'Prueba',
            'sexoid': sexo,
            'correo': CORREO,
        },
    )
    cuenta = CuentaModel.objects.filter(cedula=empleado).first()
    if not cuenta:
        cuenta = CuentaModel.objects.create_user(cedula=empleado, password=PASSWORD)
    else:
        cuenta.set_password(PASSWORD)
        cuenta.save()
    return {'cedula': empleado.cedulaidentidad, 'correo': CORREO}


@pytest.fixture
def cliente():
    return APIClient(enforce_csrf_checks=False)


def intentar_login(cliente, correo, password):
    return cliente.post(
        URL_LOGIN, {'correo': correo, 'password': password}, format='json'
    )


def test_cuatro_intentos_fallidos_no_bloquean(cuenta_login, cliente):
    for i in range(1, 5):
        resp = intentar_login(cliente, cuenta_login['correo'], 'clave-invalida')
        assert resp.status_code == 401, f'Intento {i} debió responder 401'

    cache_data = cache.get(f'{PREFIJO_CLAVE}{cuenta_login["cedula"]}') or cache.get(f'{PREFIJO_CLAVE}{cuenta_login["correo"]}')
    assert cache_data and cache_data.get('intentos') == 4

    resp_exito = intentar_login(cliente, cuenta_login['correo'], PASSWORD)
    assert resp_exito.status_code == 200


def test_quinto_intento_bloquea_y_siguiente_correcto_recibe_429(
    cuenta_login, cliente, capturar_security_backend
):
    for _ in range(5):
        resp = intentar_login(cliente, cuenta_login['correo'], 'clave-invalida')

    assert resp.status_code == 429
    assert 'bloqueada' in resp.json().get('error', '').lower()

    # El siguiente intento con credenciales correctas debe ser rechazado
    resp_valido_bloqueado = intentar_login(
        cliente, cuenta_login['correo'], PASSWORD
    )
    assert resp_valido_bloqueado.status_code == 429


def test_exito_resetea_el_contador_de_intentos(cuenta_login, cliente):
    for _ in range(3):
        intentar_login(cliente, cuenta_login['correo'], 'clave-invalida')

    cache_data = cache.get(f'{PREFIJO_CLAVE}{cuenta_login["cedula"]}') or cache.get(f'{PREFIJO_CLAVE}{cuenta_login["correo"]}')
    assert cache_data and cache_data.get('intentos') == 3

    resp = intentar_login(cliente, cuenta_login['correo'], PASSWORD)
    assert resp.status_code == 200
    assert cache.get(f'{PREFIJO_CLAVE}{cuenta_login["cedula"]}') is None
    assert cache.get(f'{PREFIJO_CLAVE}{cuenta_login["correo"]}') is None


def test_ventana_expirada_permite_reintentar_sin_penalidad(
    cuenta_login, cliente
):
    for _ in range(3):
        intentar_login(cliente, cuenta_login['correo'], 'clave-invalida')

    # Simular expiración de la ventana de tiempo borrando la clave
    cache.delete(f'{PREFIJO_CLAVE}{cuenta_login["cedula"]}')
    cache.delete(f'{PREFIJO_CLAVE}{cuenta_login["correo"]}')

    resp = intentar_login(cliente, cuenta_login['correo'], 'clave-invalida')
    assert resp.status_code == 401
    cache_data = cache.get(f'{PREFIJO_CLAVE}{cuenta_login["cedula"]}') or cache.get(f'{PREFIJO_CLAVE}{cuenta_login["correo"]}')
    assert cache_data and cache_data.get('intentos') == 1


