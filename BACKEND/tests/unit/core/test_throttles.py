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
