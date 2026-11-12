"""El PDF dibuja las formas editadas por puntos y los radios por esquina del diseñador."""
import pytest

from apps.carnetizacion.infrastructure.pdf import carnet_pdf
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    MM_A_PT,
    DatosCarnetPdf,
    generar_carnet_pdf_fiel,
    path_desde_puntos,
)

# Salidas de `generarPathDesdePuntos` (NextJS/.../forma-puntos.ts) para los mismos casos.
TRIANGULO_CON_UNA_ESQUINA = [
    {'x': 50, 'y': 0, 'r': 0}, {'x': 100, 'y': 100, 'r': 3}, {'x': 0, 'y': 100, 'r': 0},
]
CASO_FRONTEND_1 = 'M 50 0 L 95.84 91.68 Q 100 100 92.5 100 L 0 100 Z'

FRANJA_REDONDEADA = [
    {'x': 0, 'y': 0, 'r': 2}, {'x': 100, 'y': 0, 'r': 5}, {'x': 72, 'y': 100, 'r': 30}, {'x': 0, 'y': 100, 'r': 1.5},
]
CASO_FRONTEND_2 = (
    'M 0 10 Q 0 0 3.7 0 L 90.74 0 Q 100 0 94.42 19.94 L 86 50 Q 72 100 48.79 100 '
    'L 2.78 100 Q 0 100 0 92.5 Z'
)


def test_path_coincide_con_el_del_frontend():
    assert path_desde_puntos(TRIANGULO_CON_UNA_ESQUINA, 40, 30) == CASO_FRONTEND_1
    assert path_desde_puntos(FRANJA_REDONDEADA, 54, 20) == CASO_FRONTEND_2


def test_radio_se_limita_a_la_mitad_de_la_arista_mas_corta():
    # r = 30 mm en un vértice con aristas de ~10 mm: el radio efectivo no pasa de la mitad.
    sin_tope = path_desde_puntos(FRANJA_REDONDEADA, 54, 20)
    assert 'Q 72 100' in sin_tope
    assert path_desde_puntos([{'x': 0, 'y': 0, 'r': 0}] * 2, 10, 10) == ''


def _datos():
    return DatosCarnetPdf(
        nombre_completo='Ana Perez', cedula='V-1', cargo='C', departamento='D', security_hash='h' * 22,
    )


def _definicion(elemento):
    return {
        'ancho_mm': 54.0, 'alto_mm': 85.6, 'anverso': [elemento], 'reverso': [],
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
    }


def test_el_pdf_usa_props_puntos_en_los_elementos_path(monkeypatch):
    capturado = []
    original = carnet_pdf._dibujar_svg_path
    monkeypatch.setattr(
        carnet_pdf, '_dibujar_svg_path',
        lambda c, datos, *a, **k: (capturado.append(datos), original(c, datos, *a, **k))[1],
    )
    el = {
        'tipo': 'path', 'x': 0, 'y': 0, 'w': 40, 'h': 30, 'fill': '#123456',
        'props': {'d': 'M 0 0 L 100 0 L 0 100 Z', 'puntos': TRIANGULO_CON_UNA_ESQUINA},
    }
    pdf = generar_carnet_pdf_fiel(_definicion(el), _datos())
    assert pdf.startswith(b'%PDF')
    assert capturado == [CASO_FRONTEND_1]


def test_path_sin_puntos_conserva_el_path_guardado(monkeypatch):
    capturado = []
    monkeypatch.setattr(carnet_pdf, '_dibujar_svg_path', lambda c, datos, *a, **k: capturado.append(datos))
    el = {'tipo': 'path', 'x': 0, 'y': 0, 'w': 40, 'h': 30, 'props': {'d': 'M 0 0 L 100 0 L 0 100 Z', 'puntos': [{'x': 1}]}}
    generar_carnet_pdf_fiel(_definicion(el), _datos())
    assert capturado == ['M 0 0 L 100 0 L 0 100 Z']


@pytest.mark.parametrize('tipo', ['rect', 'forma'])
def test_radios_por_esquina_dibujan_un_rectangulo_con_cuatro_curvas(monkeypatch, tipo):
    capturado = []
    original = carnet_pdf._dibujar_rect_radios
    monkeypatch.setattr(
        carnet_pdf, '_dibujar_rect_radios',
        lambda c, x, y, w, h, radios, *a: (capturado.append(radios), original(c, x, y, w, h, radios, *a))[1],
    )
    el = {'tipo': tipo, 'x': 5, 'y': 5, 'w': 30, 'h': 20, 'rad': 9, 'props': {'radios': [1, 2, 3, 40]}}
    pdf = generar_carnet_pdf_fiel(_definicion(el), _datos())
    assert pdf.startswith(b'%PDF')
    # El último radio se acota a la mitad del lado menor (10 mm).
    assert capturado == [[1 * MM_A_PT, 2 * MM_A_PT, 3 * MM_A_PT, 10 * MM_A_PT]]


def test_sin_radios_se_mantiene_rad(monkeypatch):
    llamado = []
    monkeypatch.setattr(carnet_pdf, '_dibujar_rect_radios', lambda *a: llamado.append(a))
    el = {'tipo': 'rect', 'x': 5, 'y': 5, 'w': 30, 'h': 20, 'rad': 4, 'props': {}}
    pdf = generar_carnet_pdf_fiel(_definicion(el), _datos())
    assert pdf.startswith(b'%PDF')
    assert llamado == []
