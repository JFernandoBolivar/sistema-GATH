"""Endpoint de integración SILOG: verificación del QR del carnet con X-API-Key."""
import secrets
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.models.credencial_externa_model import CredencialExternaModel
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

URL = '/api/v1/integraciones/carnet/verificar/'
CLAVE = 'clave-de-prueba-silog-0123456789abcdef'


@pytest.fixture(autouse=True)
def claves(settings):
    settings.INTEGRACION_CARNET_API_KEYS = f'silog:{CLAVE},otro:{secrets.token_hex(16)}'


@pytest.fixture
def cliente():
    return APIClient()


def _carnet(activo=True, cedula='V30799436'):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'Venezolano'})
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'MASCULINO'})
    motivo, _ = MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})
    emp = EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='Ana', apellidos='Pérez', sexoid=sexo, nacionalidad_id=1,
    )
    return CarnetEmitidoModel.objects.create(
        employee=emp, motivo=motivo, security_hash=secrets.token_hex(32), activo=activo,
    )


def _get(cliente, hash_, clave=CLAVE):
    extra = {'HTTP_X_API_KEY': clave} if clave is not None else {}
    return cliente.get(URL, {'hash': hash_}, **extra)


def test_sin_clave_401(cliente):
    assert _get(cliente, 'a' * 64, clave=None).status_code == 401


def test_clave_erronea_401(cliente):
    assert _get(cliente, 'a' * 64, clave='clave-equivocada-0123456789').status_code == 401


def test_sin_claves_configuradas_503(cliente, settings):
    settings.INTEGRACION_CARNET_API_KEYS = ''
    assert _get(cliente, 'a' * 64).status_code == 503


def test_clave_corta_se_descarta(cliente, settings):
    settings.INTEGRACION_CARNET_API_KEYS = 'silog:corta'
    assert _get(cliente, 'a' * 64, clave='corta').status_code == 503


def test_vigente_devuelve_cedula_aunque_privacidad_la_oculte(cliente):
    carnet = _carnet()
    resp = _get(cliente, carnet.security_hash)
    assert resp.status_code == 200
    d = resp.json()
    assert d['valido'] is True and d['estado'] == 'VIGENTE'
    assert d['cedula'] == 'V30799436'
    assert d['nombre'] == 'Ana Pérez'
    assert d['tipo_credencial'] == 'trabajador'
    assert d['fecha_vencimiento'] is None
    assert d['version'] == 1
    assert d['fecha_emision']


def test_hash_en_mayusculas_se_acepta(cliente):
    carnet = _carnet()
    assert _get(cliente, carnet.security_hash.upper()).json()['valido'] is True


def test_anulado(cliente):
    carnet = _carnet(activo=False)
    d = _get(cliente, carnet.security_hash).json()
    assert d['valido'] is False and d['estado'] == 'ANULADO' and d['cedula'] is None
    assert d['mensaje']


@pytest.mark.parametrize('hash_', ['b' * 64, 'corto', 'z' * 64, '', "' OR 1=1 --"])
def test_inexistente_o_mal_formado_no_registrado(cliente, hash_):
    resp = _get(cliente, hash_)
    assert resp.status_code == 200
    d = resp.json()
    assert d['valido'] is False and d['estado'] == 'NO_REGISTRADO' and d['cedula'] is None


def test_sin_parametro_hash_no_registrado(cliente):
    resp = cliente.get(URL, HTTP_X_API_KEY=CLAVE)
    assert resp.status_code == 200 and resp.json()['estado'] == 'NO_REGISTRADO'


def test_no_expone_salud_ni_foto(cliente):
    carnet = _carnet()
    texto = _get(cliente, carnet.security_hash).content.decode().lower()
    for prohibido in ('salud', 'alergia', 'patolog', 'grupo_sanguineo', 'foto', 'profile', 'contactos'):
        assert prohibido not in texto


def test_cabecera_no_store(cliente):
    carnet = _carnet()
    assert 'no-store' in _get(cliente, carnet.security_hash)['Cache-Control']
    assert 'no-store' in _get(cliente, 'x')['Cache-Control']


def test_credencial_externa_vigente_y_anulada(cliente):
    tipo, _ = TipoCredencialModel.objects.get_or_create(
        codigo='visitante',
        defaults={'nombre': 'Visitante', 'descripcion': 'v', 'grupo': 'externo', 'ancho_mm': 54,
                  'alto_mm': 85.6, 'orientacion': 'vertical', 'activo': True, 'orden': 99},
    )
    ahora = timezone.now()
    datos = dict(tipo_credencial=tipo, nombre='Luis Visita', documento='V12345678', motivo='Reunión',
                 vigencia_desde=ahora - timedelta(hours=1), vigencia_hasta=ahora + timedelta(days=1))
    activa = CredencialExternaModel.objects.create(security_hash=secrets.token_hex(32), **datos)
    anulada = CredencialExternaModel.objects.create(
        security_hash=secrets.token_hex(32), estado=CredencialExternaModel.Estado.ANULADA, **datos,
    )
    d = _get(cliente, activa.security_hash).json()
    assert d['valido'] is True and d['cedula'] == 'V12345678' and d['tipo_credencial'] == 'visitante'
    d = _get(cliente, anulada.security_hash).json()
    assert d['valido'] is False and d['estado'] == 'ANULADO' and d['cedula'] is None


def test_auditoria_registra_sistema_y_hash_truncado_sin_clave(cliente):
    carnet = _carnet()
    _get(cliente, carnet.security_hash)
    reg = AuditoriaLog.objects.filter(accion='CARNET_VERIFICADO_INTEGRACION').latest('fecha_hora')
    assert reg.actor_rol == 'sistema:silog'
    assert reg.recurso_id == carnet.security_hash[:8]
    assert reg.estado_nuevo['estado'] == 'VIGENTE'
    assert reg.ip_origen
    assert CLAVE not in str(reg.estado_nuevo) and carnet.security_hash not in str(reg.estado_nuevo)


def test_auditoria_hash_mal_formado_no_guarda_el_valor(cliente):
    _get(cliente, 'valor-sospechoso')
    reg = AuditoriaLog.objects.filter(accion='CARNET_VERIFICADO_INTEGRACION').latest('fecha_hora')
    assert reg.recurso_id == 'FORMATO_INVALIDO' and reg.resultado == 'FAILED'


def test_throttle_por_sistema(cliente, settings):
    from rest_framework.settings import api_settings
    from apps.carnetizacion.presentation.integracion_auth import IntegracionCarnetThrottle

    tasas = dict(api_settings.DEFAULT_THROTTLE_RATES)
    tasas['integracion_carnet'] = '2/minute'
    IntegracionCarnetThrottle.THROTTLE_RATES = tasas
    try:
        assert _get(cliente, 'a' * 64).status_code == 200
        assert _get(cliente, 'a' * 64).status_code == 200
        assert _get(cliente, 'a' * 64).status_code == 429
    finally:
        IntegracionCarnetThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES


def test_codigo_corto_nuevo_se_verifica_y_respeta_mayusculas(cliente):
    carnet = _carnet()
    corto = 'AbCdEfGhIjKlMnOpQrSt-_'
    CarnetEmitidoModel.objects.filter(pk=carnet.pk).update(security_hash=corto)
    d = _get(cliente, corto).json()
    assert d['valido'] is True and d['estado'] == 'VIGENTE'
    # base64url distingue mayúsculas: la variante en minúsculas es otro código.
    assert _get(cliente, corto.lower()).json()['estado'] == 'NO_REGISTRADO'


def test_codigo_corto_de_credencial_externa(cliente):
    tipo, _ = TipoCredencialModel.objects.get_or_create(
        codigo='visitante',
        defaults={'nombre': 'Visitante', 'descripcion': 'v', 'grupo': 'externo', 'ancho_mm': 54,
                  'alto_mm': 85.6, 'orientacion': 'vertical', 'activo': True, 'orden': 99},
    )
    ahora = timezone.now()
    fila = CredencialExternaModel.objects.create(
        tipo_credencial=tipo, nombre='Luis Visita', documento='V12345678', motivo='Reunión',
        vigencia_desde=ahora - timedelta(hours=1), vigencia_hasta=ahora + timedelta(days=1),
        security_hash=secrets.token_urlsafe(16),
    )
    assert len(fila.security_hash) == 22
    assert _get(cliente, fila.security_hash).json()['valido'] is True


@pytest.mark.parametrize('valor', ['a' * 21, 'a' * 23, 'a' * 22 + '=', 'a' * 21 + '+', 'a' * 63])
def test_longitud_o_alfabeto_invalido_no_registrado(cliente, valor):
    assert _get(cliente, valor).json()['estado'] == 'NO_REGISTRADO'


def test_ficha_publica_acepta_ambos_formatos_y_rechaza_invalidos(cliente):
    carnet = _carnet()
    assert cliente.get(f'/api/v1/carnetizacion/public/qr/{carnet.security_hash}/').status_code == 200
    corto = secrets.token_urlsafe(16)
    CarnetEmitidoModel.objects.filter(pk=carnet.pk).update(security_hash=corto)
    assert cliente.get(f'/api/v1/carnetizacion/public/qr/{corto}/').status_code == 200
    r = cliente.get('/api/v1/carnetizacion/public/qr/no-valido/')
    assert r.json()['data']['estado'] == 'NO_REGISTRADO'
