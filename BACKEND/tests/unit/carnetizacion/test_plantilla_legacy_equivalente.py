"""B-7: la plantilla v1 LEGACY reproduce la impresión del diseño heredado.

La referencia se genera con el mismo procedimiento que usaba el PDF fijo: fondo a
sangre, QR de 12 mm abajo a la izquierda, foto de 20 × 24 mm centrada y nombre y
cédula debajo. Ambas salidas se rasterizan y se comparan píxel a píxel.

Tolerancia: la rasterización de dos PDF distintos puede diferir en los bordes por
el antialiasing del motor gráfico. Se exige el mismo tamaño y que la diferencia
máxima por canal sea <= 2 y que menos del 0,1 % de los píxeles supere 8 niveles.
"""
import base64
from io import BytesIO

from pdf2image import convert_from_bytes
from PIL import Image, ImageChops, ImageDraw, ImageStat
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_heredada,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    CARNET_HEIGHT,
    CARNET_WIDTH,
    DatosCarnetPdf,
    _dibujar_foto,
    _dibujar_qr,
    generar_carnet_pdf,
)
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA


def _fondo_heredado() -> bytes:
    """Fondo sintético determinista (sin datos personales) para la comparación."""
    imagen = Image.new('RGB', (400, 634), '#f4f7fb')
    dibujo = ImageDraw.Draw(imagen)
    dibujo.rectangle((0, 0, 399, 18), fill='#d9121f')
    dibujo.rectangle((0, 18, 399, 110), fill='#0033a0')
    dibujo.rectangle((0, 110, 399, 118), fill='#ffd100')
    dibujo.rectangle((0, 580, 399, 633), fill='#eef2f7')
    dibujo.rectangle((10, 4, 100, 56), fill='#ffffff')
    buffer = BytesIO()
    imagen.save(buffer, format='PNG')
    return buffer.getvalue()


def _foto() -> bytes:
    buffer = BytesIO()
    Image.new('RGB', (200, 240), (40, 90, 160)).save(buffer, format='PNG')
    return buffer.getvalue()


def _datos(foto: bytes) -> DatosCarnetPdf:
    return DatosCarnetPdf(
        nombre_completo='Ana Sofia Perez Luna',
        cedula='V-16.778.340',
        cargo='Especialista',
        departamento='Gestión Humana',
        security_hash='a' * 64,
        foto_bytes=foto,
    )


def _pdf_heredado_referencia(fondo: bytes, datos: DatosCarnetPdf) -> bytes:
    """Reproduce el antiguo renderizador fijo de una cara."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(CARNET_WIDTH, CARNET_HEIGHT))
    c.drawImage(
        ImageReader(BytesIO(fondo)), 0, 0, CARNET_WIDTH, CARNET_HEIGHT,
        preserveAspectRatio=False, anchor='c',
    )
    _dibujar_qr(c, datos, 0.4 * cm, 0.8 * cm, tamano=1.2 * cm)
    ancho_foto, alto_foto = 2.0 * cm, 2.4 * cm
    x_foto = (CARNET_WIDTH - ancho_foto) / 2
    y_foto = 4.6 * cm
    _dibujar_foto(c, datos.foto_bytes, x_foto, y_foto, ancho_foto, alto_foto)
    centro = CARNET_WIDTH / 2
    c.setFont(FUENTE_NEGRITA, 7)
    c.drawCentredString(centro, y_foto - 0.3 * cm, datos.nombre_completo.upper()[:30])
    c.setFont(FUENTE, 7)
    c.drawCentredString(centro, y_foto - 0.75 * cm, f'C.I: {datos.cedula}')
    c.save()
    return buffer.getvalue()


def _rasterizar(pdf: bytes) -> Image.Image:
    paginas = convert_from_bytes(pdf, dpi=150)
    assert len(paginas) == 1
    return paginas[0].convert('RGB')


def _porcentaje_pixeles_distintos(diferencia: Image.Image, umbral: int) -> float:
    canales = diferencia.split()
    mascara = None
    for canal in canales:
        puntos = canal.point(lambda p, u=umbral: 255 if p > u else 0)
        mascara = puntos if mascara is None else ImageChops.lighter(mascara, puntos)
    return sum(1 for p in mascara.getdata() if p) / (diferencia.width * diferencia.height) * 100


def test_legacy_reproduce_pixel_a_pixel_el_diseno_heredado():
    fondo = _fondo_heredado()
    datos = _datos(_foto())
    definicion = plantilla_defecto_heredada(
        'data:image/png;base64,' + base64.b64encode(fondo).decode('ascii')
    )

    pdf_legacy = generar_carnet_pdf(datos, definicion=definicion)
    pdf_referencia = _pdf_heredado_referencia(fondo, datos)

    imagen_legacy = _rasterizar(pdf_legacy)
    imagen_referencia = _rasterizar(pdf_referencia)
    assert imagen_legacy.size == imagen_referencia.size

    diferencia = ImageChops.difference(imagen_legacy, imagen_referencia)
    maximo = max(canal.getextrema()[1] for canal in diferencia.split())
    media = ImageStat.Stat(diferencia).mean[0]
    distintos = _porcentaje_pixeles_distintos(diferencia, 8)

    assert maximo <= 2, f'diferencia máxima por canal {maximo}'
    assert media <= 0.05, f'diferencia media {media}'
    assert distintos <= 0.1, f'{distintos:.3f} % de píxeles con diferencia > 8'


def test_legacy_es_una_sola_cara_y_conserva_las_dimensiones():
    datos = _datos(_foto())
    pdf = generar_carnet_pdf(datos, definicion=plantilla_defecto_heredada())
    assert pdf.count(b'/Type /Page') - pdf.count(b'/Type /Pages') == 1
