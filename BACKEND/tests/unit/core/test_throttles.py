from types import SimpleNamespace

from django.test import RequestFactory

from core.presentation.throttles import ExportRateThrottle, UploadRateThrottle


def _request(path, user_id=1):
    request = RequestFactory().post(path)
    request.user = SimpleNamespace(pk=user_id)
    request.META['REMOTE_ADDR'] = '127.0.0.1'
    return request


def test_upload_throttle_solo_cuenta_rutas_de_subida():
    throttle = UploadRateThrottle()
    assert throttle.get_cache_key(_request('/api/v1/personal/1/foto/'), None)
    assert throttle.get_cache_key(_request('/api/v1/autogestion/soportes/'), None)
    assert throttle.get_cache_key(_request('/api/v1/personal/'), None) is None


def test_export_throttle_solo_cuenta_descargas():
    throttle = ExportRateThrottle()
    assert throttle.get_cache_key(_request('/api/v1/reportes/personal/pdf/'), None)
    assert throttle.get_cache_key(_request('/api/v1/auditoria/excel/'), None)
    assert throttle.get_cache_key(_request('/api/v1/usuarios/'), None) is None


def test_num_proxies_toma_la_ip_real_de_next_y_no_la_del_contenedor(settings):
    """F2-05: con `X-Forwarded-For` de Next y NUM_PROXIES=1, la identidad es el visitante."""
    from rest_framework.throttling import SimpleRateThrottle

    class _Throttle(SimpleRateThrottle):
        rate = '1/minute'

    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}
    # DRF lee `api_settings.NUM_PROXIES`; se refresca para tomar el valor del test.
    from rest_framework.settings import api_settings

    api_settings.reload()
    try:
        throttle = _Throttle()
        request = RequestFactory().get(
            '/api/v1/fe-de-vida/constancias/publica/abc/',
            HTTP_X_FORWARDED_FOR='203.0.113.7',
        )
        request.META['REMOTE_ADDR'] = '172.18.0.5'  # IP del contenedor de Next
        assert throttle.get_ident(request) == '203.0.113.7'
    finally:
        api_settings.reload()
