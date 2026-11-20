"""B-2: fondo por cara desde la Biblioteca de Medios en el PDF del carnet.

Verifica que la imagen cubra la tarjeta antes de dibujar los campos, que cada cara
use su propio fondo, que las plantillas sin fondo no cambien y que un PDF de la
biblioteca se rasterice en vez de incrustarse.
"""
from io import BytesIO

from pdf2image import convert_from_bytes
from PIL import Image
from reportlab.pdfgen import canvas

from apps.carnetizacion.infrastructure.pdf import carnet_pdf

DATOS = {
    'nombre_completo': 'ANA PÉREZ',
    'cedula': '12345678',
    'cargo': 'ANALISTA',
    'departamento': 'TECNOLOGÍA',
    'security_hash': 'hash-fondo-b2',
}


def _png(color: tuple[int, int, int], tamano: tuple[int, int] = (160, 260)) -> bytes:
    salida = BytesIO()
    Image.new('RGB', tamano, color).save(salida, format='PNG')
    return salida.getvalue()


def _pdf_rojo() -> bytes:
    salida = BytesIO()
    c = canvas.Canvas(salida, pagesize=(100, 100))
    c.setFillColorRGB(1, 0, 0)
    c.rect(0, 0, 100, 100, fill=1, stroke=0)
    c.showPage()
    c.save()
    return salida.getvalue()


def _paginas(pdf: bytes) -> list[Image.Image]:
    return convert_from_bytes(pdf, dpi=72)


def _cerca(color: tuple[int, int, int], esperado: tuple[int, int, int], tolerancia: int = 3) -> bool:
    return all(abs(c - e) <= tolerancia for c, e in zip(color, esperado))


def _definicion(fondos: dict | None = None) -> dict:
    definicion = {
        'dimensiones': {'ancho_mm': 54, 'alto_mm': 85.6},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'anverso': [
            {'id': 'n', 'tipo': 'field', 'campo': 'nombre_completo',
             'x': 3, 'y': 20, 'w': 48, 'h': 6, 'fontSize': 8, 'bold': True},
        ],
        'reverso': [
            {'id': 'q', 'tipo': 'qr', 'x': 15, 'y': 30, 'w': 24, 'h': 24},
        ],
    }
    if fondos is not None:
        definicion['fondos'] = fondos
    return definicion


def _pdf(definicion: dict) -> bytes:
    return carnet_pdf.generar_carnet_pdf_fiel(definicion, DATOS)


def test_cada_cara_dibuja_su_propio_fondo(monkeypatch):
    monkeypatch.setattr(
        carnet_pdf, 'fondo_de_biblioteca',
        lambda medio_id: _png((255, 0, 0)) if medio_id == 'anv' else _png((0, 0, 255)),
    )
    definicion = _definicion({
        'anverso': {'biblioteca_id': 'anv', 'nombre': 'Rojo'},
        'reverso': {'biblioteca_id': 'rev', 'nombre': 'Azul'},
    })

    paginas = _paginas(_pdf(definicion))

    assert len(paginas) == 2
    assert _cerca(paginas[0].convert('RGB').getpixel((3, 3)), (255, 0, 0))
    assert _cerca(paginas[1].convert('RGB').getpixel((3, 3)), (0, 0, 255))


def test_el_fondo_se_dibuja_debajo_de_los_campos(monkeypatch):
    monkeypatch.setattr(carnet_pdf, 'fondo_de_biblioteca', lambda _id: _png((255, 0, 0)))
    definicion = _definicion({'anverso': {'biblioteca_id': 'anv'}})
    # Un rectángulo blanco opaco posterior demuestra que los elementos van encima.
    definicion['anverso'].append({
        'id': 'placa', 'tipo': 'rect', 'x': 10, 'y': 10, 'w': 34, 'h': 20,
        'props': {'fill': '#ffffff'},
    })

    pagina = _paginas(_pdf(definicion))[0].convert('RGB')

    # (10..44 mm, 10..30 mm) cae dentro de la placa blanca; el borde sigue rojo.
    assert _cerca(pagina.getpixel((40, 50)), (255, 255, 255))
    assert _cerca(pagina.getpixel((3, 3)), (255, 0, 0))


def test_plantilla_sin_fondo_conserva_el_color_de_fondo():
    pagina = _paginas(_pdf(_definicion()))[0].convert('RGB')
    assert _cerca(pagina.getpixel((3, 3)), (255, 255, 255))


def test_pdf_de_biblioteca_se_rasteriza_para_el_fondo(monkeypatch):
    monkeypatch.setattr(carnet_pdf, '_bytes_de_biblioteca', lambda _id, _prefijo: _pdf_rojo())

    pagina = _paginas(_pdf(_definicion({'anverso': {'biblioteca_id': 'pdf-historico-b2'}})))[0].convert('RGB')

    assert _cerca(pagina.getpixel((3, 3)), (255, 0, 0))


def test_un_medio_no_rasterizable_se_ignora_y_no_rompe_el_pdf(monkeypatch):
    monkeypatch.setattr(carnet_pdf, '_bytes_de_biblioteca', lambda _id, _prefijo: b'no-es-una-imagen')

    pdf = _pdf(_definicion({'anverso': {'biblioteca_id': 'roto-b2'}}))

    assert pdf.startswith(b'%PDF')
    assert _cerca(_paginas(pdf)[0].convert('RGB').getpixel((3, 3)), (255, 255, 255))
