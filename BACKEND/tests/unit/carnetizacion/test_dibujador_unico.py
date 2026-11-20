"""
Lo diseñado es lo impreso (seguimiento A-1, A-2, A-3):

- El PDF individual y el de lote dibujan cada cara con el mismo `dibujar_cara`.
- Las imágenes de la Biblioteca de Medios (`props.biblioteca_id`) se dibujan.
- La rotación (`r`) y la opacidad (`op`) del diseñador se aplican en el PDF.
"""
from io import BytesIO

import pytest
from PIL import Image
from reportlab.pdfgen import canvas

from apps.carnetizacion.infrastructure.pdf import carnet_pdf
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import generar_carnet_pdf_fiel
from apps.carnetizacion.infrastructure.pdf.carnet_pdf_lote import generar_pdf_lote

DATOS = {
    'nombre_completo': 'MARÍA ALEJANDRA RODRÍGUEZ DE LOS SANTOS',
    'cedula': '12345678',
    'cargo': 'ANALISTA',
    'departamento': 'TALENTO HUMANO',
    'nomina': 'EMPLEADO',
    'security_hash': 'abc123',
}


def _definicion(anverso: list[dict], reverso: list[dict] | None = None) -> dict:
    return {
        'dimensiones': {'ancho_mm': 54, 'alto_mm': 85.6},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'anverso': anverso,
        'reverso': reverso or [],
    }


def _png() -> bytes:
    salida = BytesIO()
    Image.new('RGBA', (40, 20), (200, 0, 0, 255)).save(salida, 'PNG')
    return salida.getvalue()


@pytest.fixture
def espia_canvas(monkeypatch):
    """Registra las llamadas a métodos de Canvas sin alterar su efecto."""
    llamadas: list[tuple[str, tuple]] = []

    def espiar(nombre):
        original = getattr(canvas.Canvas, nombre)

        def envoltura(self, *args, **kwargs):
            llamadas.append((nombre, args))
            return original(self, *args, **kwargs)

        monkeypatch.setattr(canvas.Canvas, nombre, envoltura)

    for nombre in ('rotate', 'setFillAlpha', 'setStrokeAlpha', 'drawImage', 'drawCentredString', 'clipPath'):
        espiar(nombre)
    return llamadas


def test_individual_y_lote_dibujan_los_mismos_elementos(monkeypatch):
    vistos: list[str] = []
    original = carnet_pdf._dibujar_elemento

    def espia(c, el, *args, **kwargs):
        vistos.append(el['id'])
        return original(c, el, *args, **kwargs)

    monkeypatch.setattr(carnet_pdf, '_dibujar_elemento', espia)
    definicion = _definicion(
        [
            {'id': 'franja', 'tipo': 'rect', 'x': 0, 'y': 0, 'w': 54, 'h': 10, 'props': {'radios': [3, 0, 0, 3]}},
            {'id': 'nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'x': 2, 'y': 40, 'w': 50, 'h': 8},
        ],
        [{'id': 'qr', 'tipo': 'qr', 'x': 15, 'y': 30, 'w': 24, 'h': 24}],
    )

    generar_carnet_pdf_fiel(definicion, DATOS)
    individual = list(vistos)
    vistos.clear()
    generar_pdf_lote([{'definicion': definicion, 'datos': DATOS}])

    assert individual == ['franja', 'nombre', 'qr']
    assert vistos == individual


def test_cada_tarjeta_del_lote_se_recorta_a_su_borde(espia_canvas):
    definicion = _definicion([{'id': 'a', 'tipo': 'rect', 'x': -5, 'y': 0, 'w': 70, 'h': 5}])
    generar_pdf_lote([{'definicion': definicion, 'datos': DATOS}] * 3)

    recortes = [n for n, _ in espia_canvas if n == 'clipPath']
    assert len(recortes) == 3 * 2  # tres tarjetas, anverso y reverso


def test_imagen_de_biblioteca_se_dibuja(monkeypatch, espia_canvas):
    pedidos: list[str] = []

    def falsa(medio_id):
        pedidos.append(medio_id)
        return _png()

    monkeypatch.setattr(carnet_pdf, 'imagen_de_biblioteca', falsa)
    definicion = _definicion([
        {'id': 'firma', 'tipo': 'image', 'x': 5, 'y': 60, 'w': 30, 'h': 10,
         'props': {'biblioteca_id': '42', 'label': 'FIRMA'}},
    ])

    generar_carnet_pdf_fiel(definicion, DATOS)

    assert pedidos == ['42']
    assert any(n == 'drawImage' for n, _ in espia_canvas)
    assert not any(n == 'drawCentredString' and 'FIRMA' in args for n, args in espia_canvas)


def test_imagen_de_biblioteca_ilegible_deja_el_marcador(monkeypatch, espia_canvas):
    monkeypatch.setattr(carnet_pdf, 'imagen_de_biblioteca', lambda _id: None)
    definicion = _definicion([
        {'id': 'firma', 'tipo': 'image', 'x': 5, 'y': 60, 'w': 30, 'h': 10,
         'props': {'biblioteca_id': '99', 'label': 'FIRMA'}},
    ])

    generar_carnet_pdf_fiel(definicion, DATOS)

    assert any(n == 'drawCentredString' and 'FIRMA' in args for n, args in espia_canvas)


def test_rotacion_del_disenador_se_aplica(espia_canvas):
    definicion = _definicion([
        {'id': 'girado', 'tipo': 'rect', 'x': 10, 'y': 10, 'w': 20, 'h': 5, 'r': 30},
        {'id': 'derecho', 'tipo': 'rect', 'x': 10, 'y': 30, 'w': 20, 'h': 5},
    ])

    generar_carnet_pdf_fiel(definicion, DATOS)

    # Konva gira en sentido horario con Y hacia abajo; en PDF (Y hacia arriba) es el signo opuesto.
    assert [args for n, args in espia_canvas if n == 'rotate'] == [(-30.0,)]


def test_opacidad_del_disenador_sigue_vigente_al_dibujar(monkeypatch):
    """ReportLab restablece el alfa en cada setFillColor: lo que importa es el alfa del
    estado gráfico en el momento exacto de pintar, no que se haya pedido antes."""
    alfa_al_dibujar: dict[str, float] = {}

    def espiar(nombre):
        original = getattr(canvas.Canvas, nombre)

        def envoltura(self, x, y, texto, *args, **kwargs):
            alfa_al_dibujar[texto] = self._fillAlpha
            return original(self, x, y, texto, *args, **kwargs)

        monkeypatch.setattr(canvas.Canvas, nombre, envoltura)

    for nombre in ('drawString', 'drawCentredString', 'drawRightString'):
        espiar(nombre)
    original_alpha = canvas.Canvas.setFillAlpha

    def set_alpha(self, a):
        self._fillAlpha = a
        return original_alpha(self, a)

    monkeypatch.setattr(canvas.Canvas, 'setFillAlpha', set_alpha)
    monkeypatch.setattr(canvas.Canvas, '_fillAlpha', 1, raising=False)

    definicion = _definicion([
        {'id': 'marca', 'tipo': 'text', 'texto': 'CONATEL', 'x': 5, 'y': 40, 'w': 40, 'h': 8, 'op': 25},
        {'id': 'normal', 'tipo': 'text', 'texto': 'NORMAL', 'x': 5, 'y': 50, 'w': 40, 'h': 8},
    ])

    generar_carnet_pdf_fiel(definicion, DATOS)

    assert alfa_al_dibujar['CONATEL'] == 0.25
    assert alfa_al_dibujar['NORMAL'] == 1


def test_opacidad_en_el_pdf_generado():
    definicion = _definicion([
        {'id': 'marca', 'tipo': 'rect', 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'props': {'op': 25, 'fill': '#ff0000'}},
    ])
    pdf = generar_carnet_pdf_fiel(definicion, DATOS)
    assert b'/ca .25' in pdf


def test_el_pdf_sigue_teniendo_dos_paginas():
    pdf = generar_carnet_pdf_fiel(_definicion([{'id': 'a', 'tipo': 'rect', 'x': 0, 'y': 0, 'w': 5, 'h': 5}]), DATOS)
    assert pdf.startswith(b'%PDF')
    assert pdf.count(b'/Type /Page') - pdf.count(b'/Type /Pages') == 2
