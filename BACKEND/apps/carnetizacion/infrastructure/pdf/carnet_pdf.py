"""
Generador del PDF físico del carnet institucional (Fase 2.3 del plan de
reparación, `PLAN_REPARACION_GATH.md`).

Réplica funcional de `CARNETIZACION/services/designer.py` (recuperable con
`git show HEAD:BACKEND/CARNETIZACION/services/designer.py`), adaptada a
Onion: módulo de infraestructura puro — no toca el ORM ni el request/response
HTTP, solo recibe datos primitivos (`DatosCarnetPdf`) y devuelve bytes de PDF.
El QR codifica `security_hash` en vez del ID secuencial del carnet que usaba
el legado (ALTA-05: el ID adivinable ya no debe circular, ni siquiera en el
propio carnet impreso).

No se porta `generar_vista_previa`/`generar_vista_previa_html` (conversión a
PNG vía `pdf2image`, que requiere el binario `poppler` instalado en el
sistema) — el PDF generado aquí ya sirve como vista previa descargable.
"""
import logging
from dataclasses import dataclass
from io import BytesIO

import qrcode
import qrcode.constants
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

logger = logging.getLogger('gath.carnetizacion')

CARNET_WIDTH = 5.5 * cm
CARNET_HEIGHT = 8.56 * cm

_TEXTO_MAX_ANCHO = 2.5 * cm
_TEXTO_MIN_FUENTE = 5


@dataclass(frozen=True)
class DatosCarnetPdf:
    nombre_completo: str
    cedula: str
    cargo: str
    departamento: str
    security_hash: str
    plantilla_path: str | None = None
    foto_bytes: bytes | None = None


def _calcular_tamano_fuente(texto: str, fuente: str = "Helvetica", max_ancho: float = _TEXTO_MAX_ANCHO, tamano_inicial: float = 8) -> float:
    tamano = tamano_inicial
    while stringWidth(texto, fuente, tamano) > max_ancho and tamano > _TEXTO_MIN_FUENTE:
        tamano -= 0.5
    return round(max(tamano, _TEXTO_MIN_FUENTE), 1)


def _dividir_texto_en_lineas(texto: str, fuente: str, tamano: float, max_ancho: float) -> list[str]:
    palabras = texto.split()
    lineas: list[str] = []
    linea_actual = ""
    for palabra in palabras:
        prueba = f"{linea_actual} {palabra}".strip()
        if stringWidth(prueba, fuente, tamano) <= max_ancho:
            linea_actual = prueba
            continue
        if linea_actual:
            lineas.append(linea_actual)
        linea_actual = palabra
    if linea_actual:
        lineas.append(linea_actual)
    return lineas


def _colocar_texto_ajustado(c: canvas.Canvas, texto: str, x: float, y: float, bold: bool = False, max_ancho: float | None = None, tamano_inicial: float = 8) -> None:
    fuente = "Helvetica-Bold" if bold else "Helvetica"
    palabra_mas_larga = max(texto.split(), key=len) if texto.split() else texto
    tamano = _calcular_tamano_fuente(palabra_mas_larga, fuente, max_ancho or _TEXTO_MAX_ANCHO, tamano_inicial)
    lineas = _dividir_texto_en_lineas(texto, fuente, tamano, max_ancho) if max_ancho else [texto]

    line_height = tamano * 1.2
    c.setFont(fuente, tamano)
    c.setFillColorRGB(0, 0, 0)
    for i, linea in enumerate(lineas):
        c.drawCentredString(x, y - i * line_height, linea)


def _dibujar_placeholder_foto(c: canvas.Canvas, x: float, y: float, ancho: float, alto: float) -> None:
    c.setFillColorRGB(0.96, 0.96, 0.96)
    c.rect(x, y, ancho, alto, fill=1)
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.setFont("Helvetica", 6)
    c.drawCentredString(x + ancho / 2, y + alto / 2 - 0.2 * cm, "FOTO")


def _dibujar_fondo_emergencia(c: canvas.Canvas) -> None:
    c.setFillColorRGB(1, 1, 1)
    c.rect(0, 0, CARNET_WIDTH, CARNET_HEIGHT, fill=1)
    c.setStrokeColorRGB(0, 0.2, 0.4)
    c.setLineWidth(0.5)
    c.rect(0.1 * cm, 0.1 * cm, CARNET_WIDTH - 0.2 * cm, CARNET_HEIGHT - 0.2 * cm, fill=0)
    c.setFont("Helvetica", 6)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(CARNET_WIDTH / 2, CARNET_HEIGHT / 2, "USANDO PLANTILLA OFICIAL")


def _dibujar_qr(c: canvas.Canvas, datos: DatosCarnetPdf, x: float, y: float, tamano: float = 1.2 * cm) -> None:
    contenido = (
        f"CI: {datos.cedula}\n"
        f"Nombre: {datos.nombre_completo[:25]}\n"
        f"Cargo: {(datos.cargo or '')[:33]}\n"
        f"Depto: {(datos.departamento or '')[:50]}\n"
        f"Hash: {datos.security_hash}"
    )
    qr = qrcode.QRCode(version=10, box_size=2, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(contenido)
    qr.make(fit=True)

    qr_buffer = BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    c.drawImage(ImageReader(qr_buffer), x, y, tamano, tamano)

    c.setFont("Helvetica", 2.5)
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.drawString(x, y - 0.15 * cm, f"CI: {datos.cedula}")


def _dibujar_foto(c: canvas.Canvas, foto_bytes: bytes | None, x: float, y: float, ancho: float, alto: float) -> None:
    if foto_bytes:
        try:
            pil_image = Image.open(BytesIO(foto_bytes))
            target_ratio = ancho / alto
            img_width, img_height = pil_image.size
            img_ratio = img_width / img_height
            if img_ratio > target_ratio:
                nuevo_ancho = int(img_height * target_ratio)
                offset = (img_width - nuevo_ancho) // 2
                pil_image = pil_image.crop((offset, 0, offset + nuevo_ancho, img_height))
            elif img_ratio < target_ratio:
                nuevo_alto = int(img_width / target_ratio)
                offset = (img_height - nuevo_alto) // 2
                pil_image = pil_image.crop((0, offset, img_width, offset + nuevo_alto))
            recorte_buffer = BytesIO()
            pil_image.save(recorte_buffer, format="PNG")
            recorte_buffer.seek(0)
            c.drawImage(ImageReader(recorte_buffer), x, y, ancho, alto, preserveAspectRatio=True, anchor="c")
            return
        except Exception:
            logger.warning("No se pudo dibujar la foto del carnet; se usa el placeholder.", exc_info=True)
    _dibujar_placeholder_foto(c, x, y, ancho, alto)


def generar_carnet_pdf(datos: DatosCarnetPdf) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(CARNET_WIDTH, CARNET_HEIGHT))
    c.setAuthor("CONATEL - Sistema de Carnetización")
    c.setTitle(f"Carnet {datos.nombre_completo}")
    c.setSubject("Carnet Institucional")
    c.setKeywords("CONATEL, carnet, identificación")

    if datos.plantilla_path:
        try:
            c.drawImage(ImageReader(datos.plantilla_path), 0, 0, CARNET_WIDTH, CARNET_HEIGHT, preserveAspectRatio=False, anchor="c")
        except Exception:
            logger.warning("No se pudo dibujar la plantilla del carnet; se usa el fondo de emergencia.", exc_info=True)
            _dibujar_fondo_emergencia(c)
    else:
        _dibujar_fondo_emergencia(c)

    qr_tamano = 1.2 * cm
    x_qr, y_qr = 0.4 * cm, 0.8 * cm
    c.setFillColorRGB(1, 1, 1)
    c.rect(x_qr - 0.1 * cm, y_qr - 0.1 * cm, qr_tamano + 0.2 * cm, qr_tamano + 0.2 * cm, fill=1, stroke=0)
    _dibujar_qr(c, datos, x_qr, y_qr, tamano=qr_tamano)

    photo_width, photo_height = 2.0 * cm, 2.4 * cm
    x_foto = (CARNET_WIDTH - photo_width) / 2
    y_foto = 4.6 * cm
    c.setStrokeColor(HexColor("#003366"))
    c.setLineWidth(0.8)
    c.rect(x_foto, y_foto, photo_width, photo_height, fill=0)
    _dibujar_foto(c, datos.foto_bytes, x_foto, y_foto, photo_width, photo_height)

    center_x = CARNET_WIDTH / 2
    max_text_width = CARNET_WIDTH - 0.80 * cm
    text_start_y = y_foto - 0.3 * cm
    line_spacing = 0.45 * cm

    _colocar_texto_ajustado(c, datos.nombre_completo.upper(), center_x, text_start_y, bold=True, max_ancho=max_text_width, tamano_inicial=7)
    _colocar_texto_ajustado(c, f"C.I: {datos.cedula}", center_x, text_start_y - line_spacing, max_ancho=max_text_width, tamano_inicial=7)
    _colocar_texto_ajustado(c, (datos.cargo or "").upper(), center_x, text_start_y - 2 * line_spacing, bold=True, max_ancho=max_text_width, tamano_inicial=6)
    _colocar_texto_ajustado(c, (datos.departamento or "").upper(), center_x, text_start_y - 3.3 * line_spacing, bold=True, max_ancho=max_text_width, tamano_inicial=6)

    c.save()
    return buffer.getvalue()
