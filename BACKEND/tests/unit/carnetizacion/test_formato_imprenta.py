"""
PDF «formato imprenta» (seguimiento B-3): sangrado configurable y marcas de corte en el carnet
individual, con TrimBox/BleedBox para la imprenta.
"""
import re

import pytest
from pdf2image import convert_from_bytes

from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    MARGEN_MARCAS_MM,
    MM_A_PT,
    _extender_al_sangrado,
    generar_carnet_pdf_fiel,
)

DATOS = {'nombre_completo': 'ANA PRUEBA', 'cedula': '1', 'cargo': 'X', 'departamento': 'Y',
         'nomina': 'Z', 'security_hash': 'h'}
DEFINICION = {
    'dimensiones': {'ancho_mm': 54, 'alto_mm': 85.6},
    'bg': {'anverso': '#ff0000', 'reverso': '#ffffff'},
    'anverso': [
        # Franja superior que toca tres bordes: debe prolongarse al sangrado.
        {'id': 'franja', 'tipo': 'rect', 'x': 0, 'y': 0, 'w': 54, 'h': 14, 'props': {'fill': '#0000ff'}},
        {'id': 'nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'x': 2, 'y': 40, 'w': 50, 'h': 8},
    ],
    'reverso': [],
}


def _caja(pdf: bytes, nombre: str) -> list[float]:
    m = re.search(rb'/' + nombre.encode() + rb'\s*\[\s*([-\d.\s]+)\]', pdf)
    assert m, f'el PDF no declara {nombre}'
    return [float(v) for v in m.group(1).split()]


def test_formato_normal_no_cambia():
    pdf = generar_carnet_pdf_fiel(DEFINICION, DATOS)
    ancho, alto = _caja(pdf, 'MediaBox')[2:]
    assert ancho == pytest.approx(54 * MM_A_PT, abs=0.01)
    assert alto == pytest.approx(85.6 * MM_A_PT, abs=0.01)
    assert b'/TrimBox' not in pdf


def test_formato_imprenta_agranda_la_pagina_y_declara_corte_y_sangrado():
    pdf = generar_carnet_pdf_fiel(DEFINICION, DATOS, sangrado_mm=2, marcas_corte=True)

    borde = (2 + MARGEN_MARCAS_MM) * MM_A_PT
    ancho, alto = _caja(pdf, 'MediaBox')[2:]
    assert ancho == pytest.approx(54 * MM_A_PT + 2 * borde, abs=0.01)
    assert alto == pytest.approx(85.6 * MM_A_PT + 2 * borde, abs=0.01)
    corte = _caja(pdf, 'TrimBox')
    sangrado = _caja(pdf, 'BleedBox')
    assert corte[0] == pytest.approx(borde, abs=0.01)
    assert corte[2] - corte[0] == pytest.approx(54 * MM_A_PT, abs=0.01)
    assert sangrado[0] == pytest.approx(borde - 2 * MM_A_PT, abs=0.01)


def test_solo_los_rectangulos_que_tocan_el_borde_se_prolongan():
    franja = _extender_al_sangrado(DEFINICION['anverso'][0], 54, 85.6, 2)
    assert (franja['x'], franja['y'], franja['w'], franja['h']) == (-2, -2, 58, 16)

    interior = {'tipo': 'rect', 'x': 5, 'y': 20, 'w': 10, 'h': 10}
    assert _extender_al_sangrado(interior, 54, 85.6, 2) == interior

    texto = {'tipo': 'text', 'x': 0, 'y': 0, 'w': 54, 'h': 5}
    assert _extender_al_sangrado(texto, 54, 85.6, 2) == texto


def test_el_sangrado_toma_el_color_del_diseno_y_el_margen_queda_en_blanco():
    pdf = generar_carnet_pdf_fiel(DEFINICION, DATOS, sangrado_mm=2, marcas_corte=True)
    [img] = convert_from_bytes(pdf, first_page=1, last_page=1, dpi=150)
    px_mm = 150 / 25.4
    a_px = lambda mm: int(round(mm * px_mm))  # noqa: E731
    imagen = img.convert('RGB')

    # 1 mm por fuera del corte, a media altura: sangrado con el fondo rojo.
    assert imagen.getpixel((a_px(MARGEN_MARCAS_MM + 1), a_px(MARGEN_MARCAS_MM + 2 + 50))) == (255, 0, 0)
    # 1 mm por fuera del corte superior: sangrado con la franja azul.
    assert imagen.getpixel((a_px(MARGEN_MARCAS_MM + 2 + 27), a_px(MARGEN_MARCAS_MM + 1))) == (0, 0, 255)
    # En el margen de las marcas, lejos de ellas: blanco.
    assert imagen.getpixel((a_px(1), a_px(MARGEN_MARCAS_MM + 2 + 50))) == (255, 255, 255)
