"""El QR del carnet (PDF y vista web) lleva la URL de verificación cuando hay FRONTEND_URL."""
from apps.carnetizacion.infrastructure.qr_institucional import contenido_qr_carnet


def test_con_frontend_url_es_la_url_de_verificacion(settings):
    settings.FRONTEND_URL = 'https://gath.conatel.gob.ve/'
    assert contenido_qr_carnet('abc123') == 'https://gath.conatel.gob.ve/carnet/abc123'


def test_sin_frontend_url_es_el_respaldo_legible(settings):
    settings.FRONTEND_URL = ''
    assert contenido_qr_carnet('abc123', '12345678', 'ANA PEREZ') == (
        'GATH-ID: abc123\nCI: 12345678\nTitular: ANA PEREZ\n'
    )
