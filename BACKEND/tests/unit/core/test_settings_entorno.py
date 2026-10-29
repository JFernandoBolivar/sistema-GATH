"""Settings: sin valores de despliegue hardcodeados y con los nombres correctos de django-cors-headers."""
from django.conf import settings


def test_cors_usa_el_nombre_correcto_de_la_libreria():
    assert not hasattr(settings, "CORS_ALLOWED_HEADERS")  # nombre inexistente: se ignoraba
    cabeceras = {h.lower() for h in settings.CORS_ALLOW_HEADERS}
    assert {"content-type", "x-csrftoken", "authorization"} <= cabeceras


def test_carnet_validator_url_por_defecto_deriva_del_frontend_no_de_un_dominio_de_ejemplo():
    assert "midominio.com" not in settings.CARNET_VALIDATOR_URL


def test_poppler_path_no_fija_una_ruta_de_windows():
    assert not (settings.POPPLER_PATH or "").startswith("C:")


def test_correo_remitente_sin_default_institucional_embebido():
    import inspect
    from GATH import settings as modulo

    codigo = inspect.getsource(modulo)
    assert "default='conatelenlinea@" not in codigo
    assert "172.16." not in codigo and "192.168." not in codigo
