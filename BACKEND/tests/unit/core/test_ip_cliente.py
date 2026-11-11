"""AUD3-04: IP real del cliente detrás de proxies de confianza (`NUM_PROXIES`)."""
from types import SimpleNamespace

from django.test import override_settings

from core.presentation.ip_cliente import ip_del_cliente


def _peticion(xff: str | None = None, remota: str = '10.0.0.9'):
    meta = {'REMOTE_ADDR': remota}
    if xff is not None:
        meta['HTTP_X_FORWARDED_FOR'] = xff
    return SimpleNamespace(META=meta)


def test_sin_xff_devuelve_remote_addr():
    assert ip_del_cliente(_peticion()) == '10.0.0.9'


@override_settings(REST_FRAMEWORK={'NUM_PROXIES': 1})
def test_un_proxy_toma_el_ultimo_salto():
    assert ip_del_cliente(_peticion('203.0.113.7, 10.0.0.9')) == '10.0.0.9'


@override_settings(REST_FRAMEWORK={'NUM_PROXIES': 2})
def test_dos_proxies_toman_el_penultimo_salto():
    assert ip_del_cliente(_peticion('198.51.100.1, 203.0.113.7, 10.0.0.9')) == '203.0.113.7'


@override_settings(REST_FRAMEWORK={'NUM_PROXIES': 0})
def test_sin_proxies_ignora_la_cabecera_falsificable():
    assert ip_del_cliente(_peticion('6.6.6.6')) == '10.0.0.9'


@override_settings(REST_FRAMEWORK={'NUM_PROXIES': 3})
def test_mas_proxies_que_saltos_no_falla():
    assert ip_del_cliente(_peticion('203.0.113.7, 10.0.0.9')) == '203.0.113.7'


def test_lee_el_valor_real_de_rest_framework():
    """Regresión: la función debe leer REST_FRAMEWORK['NUM_PROXIES'], no un ajuste suelto."""
    from django.conf import settings
    esperado = settings.REST_FRAMEWORK.get('NUM_PROXIES')
    peticion = _peticion('203.0.113.7, 10.0.0.9')
    assert ip_del_cliente(peticion) == ('10.0.0.9' if esperado else '10.0.0.9')
    with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'NUM_PROXIES': 2}):
        assert ip_del_cliente(peticion) == '203.0.113.7'
