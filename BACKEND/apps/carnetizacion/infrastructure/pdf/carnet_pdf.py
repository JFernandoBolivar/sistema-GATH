"""
Generador fiel del PDF físico del carnet institucional (O44 - E8).
Permite renderizar credenciales de alta fidelidad directamente desde la definición
canónica JSON de la plantilla (en mm, dos caras, reglas de color dinámicas,
geometría vectorial y tipografía embebida con fallback métrico exacto).

Mantiene total compatibilidad con DatosCarnetPdf y la API previa de generar_carnet_pdf.
"""
import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Any

import qrcode
import qrcode.constants
from django.conf import settings
from PIL import Image
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.pdf_components import ruta_asset
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_trabajador,
)
from apps.carnetizacion.domain.services.resolver_color import (
    resolver_color_carnet,
)

logger = logging.getLogger('gath.carnetizacion')

# Factor de conversión canónico: 1 mm = 72 / 25.4 puntos tipográficos
MM_A_PT = 72.0 / 25.4

# Dimensiones estándar ID-1 (54 x 85.6 mm)
CARNET_WIDTH = 54.0 * MM_A_PT
CARNET_HEIGHT = 85.6 * MM_A_PT

_TEXTO_MAX_ANCHO = 2.5 * cm
_TEXTO_MIN_FUENTE = 5


@dataclass(frozen=True)
class DatosCarnetPdf:
    nombre_completo: str
    cedula: str
    cargo: str
    departamento: str
    security_hash: str
    nomina: str = "Funcionario"
    plantilla_path: str | None = None
    foto_bytes: bytes | None = None


def _hex_seguro(valor: str | None, defecto: str = '#111827') -> HexColor:
    """Convierte un string hex a HexColor de forma segura contra formatos inválidos."""
    if not valor or not isinstance(valor, str):
        return HexColor(defecto)
    val = valor.strip()
    if not val.startswith('#'):
        val = f"#{val}"
    try:
        return HexColor(val)
    except Exception:
        return HexColor(defecto)


def _dibujar_qr(c: canvas.Canvas, datos: DatosCarnetPdf | dict[str, Any], x: float, y: float, tamano: float = 1.2 * cm) -> None:
    """Genera y dibuja el código QR seguro con el security_hash criptográfico."""
    sec_hash = getattr(datos, 'security_hash', None) or (datos.get('security_hash') if isinstance(datos, dict) else '')
    cedula = getattr(datos, 'cedula', None) or (datos.get('cedula') if isinstance(datos, dict) else '')
    nombre = getattr(datos, 'nombre_completo', None) or (datos.get('nombre_completo') if isinstance(datos, dict) else '')

    base_frontend = str(getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    if base_frontend:
        # La cámara del teléfono abre directamente la ficha pública de verificación.
        contenido = f"{base_frontend}/carnet/{sec_hash}"
    else:
        # Respaldo legible para entornos sin FRONTEND_URL configurada.
        contenido = (
            f"GATH-ID: {sec_hash}\n"
            f"CI: {cedula}\n"
            f"Titular: {str(nombre)[:30]}\n"
        )
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=3, border=1)
    qr.add_data(contenido)
    qr.make(fit=True)

    qr_buffer = BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    c.drawImage(ImageReader(qr_buffer), x, y, tamano, tamano)


def _dibujar_placeholder_foto(c: canvas.Canvas, x: float, y: float, ancho: float, alto: float, rad: float = 0) -> None:
    """Dibuja una silueta estilizada cuando el trabajador aún no tiene fotografía cargada."""
    c.saveState()
    c.setFillColorRGB(0.92, 0.94, 0.96)
    c.setStrokeColorRGB(0.8, 0.84, 0.9)
    c.setLineWidth(0.5)
    c.roundRect(x, y, ancho, alto, rad, fill=1, stroke=1)

    # Silueta de avatar humano
    c.setFillColorRGB(0.65, 0.7, 0.78)
    radio_cabeza = min(ancho, alto) * 0.18
    centro_x = x + ancho / 2
    cabeza_y = y + alto * 0.58
    c.circle(centro_x, cabeza_y, radio_cabeza, fill=1, stroke=0)

    c.ellipse(centro_x - ancho * 0.35, y + alto * 0.05, centro_x + ancho * 0.35, y + alto * 0.42, fill=1, stroke=0)
    c.restoreState()


def _dibujar_foto(c: canvas.Canvas, foto_bytes: bytes | None, x: float, y: float, ancho: float, alto: float, rad: float = 0) -> None:
    """Dibuja la foto del titular ajustada proporcionalmente y recortada al recuadro."""
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
            logger.warning("No se pudo procesar la foto del carnet; usando silueta de respaldo.", exc_info=True)

    _dibujar_placeholder_foto(c, x, y, ancho, alto, rad)


def _extraer_valor_campo(campo: str, datos: DatosCarnetPdf | dict[str, Any]) -> str:
    """Resuelve el valor del campo a partir del objeto o diccionario del titular."""
    if isinstance(datos, DatosCarnetPdf):
        mapa = {
            'nombre': datos.nombre_completo,
            'nombre_completo': datos.nombre_completo,
            'cedula': datos.cedula,
            'cargo': datos.cargo,
            'departamento': datos.departamento,
            'oficina': datos.departamento,
            'nomina': datos.nomina,
            'tipo_personal': datos.nomina,
        }
        return mapa.get(campo, '')
    if isinstance(datos, dict):
        return str(datos.get(campo, '') or '')
    return ''


def generar_carnet_pdf_fiel(definicion: dict[str, Any], datos: DatosCarnetPdf | dict[str, Any]) -> bytes:
    """
    Motor canónico de impresión fiel ReportLab (O44 - E8).
    Interpreta capa por capa la definición geométrica y genera un documento PDF de 2 páginas
    (anverso y reverso) respetando dimensiones milimétricas, fuentes institucionales y reglas de color.
    """
    # 1. Resolver dimensiones físicas en puntos
    dims = definicion.get('dimensiones', {})
    ancho_mm = float(definicion.get('ancho_mm') or dims.get('ancho_mm') or 54.0)
    alto_mm = float(definicion.get('alto_mm') or dims.get('alto_mm') or 85.6)

    ancho_pt = ancho_mm * MM_A_PT
    alto_pt = alto_mm * MM_A_PT

    # 2. Convertir datos a dict para resolución de reglas
    if isinstance(datos, DatosCarnetPdf):
        datos_dict = {
            'nombre_completo': datos.nombre_completo,
            'cedula': datos.cedula,
            'cargo': datos.cargo,
            'departamento': datos.departamento,
            'oficina': datos.departamento,
            'nomina': datos.nomina,
            'security_hash': datos.security_hash,
        }
        foto_bytes = datos.foto_bytes
    else:
        datos_dict = datos
        foto_bytes = datos.get('foto_bytes')

    # 3. Resolver reglas de color institucionales (O44 - E7)
    colores_regla = resolver_color_carnet(definicion, datos_dict)

    def resolver_color_elemento(val: str | None, defecto: str = '#111827') -> HexColor:
        if not val:
            return HexColor(defecto)
        if val == 'rule:primario':
            return _hex_seguro(colores_regla.get('primario'), '#1f3a5f')
        if val == 'rule:acento':
            return _hex_seguro(colores_regla.get('acento'), '#1273bd')
        if val == 'rule:texto':
            return _hex_seguro(colores_regla.get('texto'), '#ffffff')
        return _hex_seguro(val, defecto)

    # 4. Agrupar elementos por cara (anverso / reverso)
    if 'anverso' in definicion and 'reverso' in definicion:
        caras = [
            ('anverso', definicion.get('anverso', [])),
            ('reverso', definicion.get('reverso', [])),
        ]
    else:
        elementos_totales = definicion.get('elementos', [])
        caras = [
            ('anverso', [e for e in elementos_totales if e.get('cara', 'anverso') == 'anverso']),
            ('reverso', [e for e in elementos_totales if e.get('cara') == 'reverso']),
        ]

    bg_cfg = definicion.get('bg', {})

    # 5. Inicializar Canvas de ReportLab
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(ancho_pt, alto_pt), pageCompression=0)
    c.setAuthor("GATH - Sistema de Carnetización Institucional")
    nombre_doc = datos_dict.get('nombre_completo', 'Credencial')
    c.setTitle(f"Carnet {nombre_doc}")
    c.setSubject("Credencial Institucional Oficial")

    for idx_cara, (nombre_cara, lista_elementos) in enumerate(caras):
        # Color de fondo de la cara
        color_fondo = bg_cfg.get(nombre_cara, '#ffffff') if isinstance(bg_cfg, dict) else '#ffffff'
        c.setFillColor(_hex_seguro(color_fondo, '#ffffff'))
        c.rect(0, 0, ancho_pt, alto_pt, fill=1, stroke=0)

        for el in lista_elementos:
            if el.get('oculto') or el.get('hidden'):
                continue

            tipo = el.get('tipo') or el.get('t')
            props = el.get('props', {})

            x_mm = float(el.get('x', 0))
            y_mm = float(el.get('y', 0))
            w_mm = float(el.get('w', 10))
            h_mm = float(el.get('h', 10))

            # Conversión milimétrica a puntos con origen superior invertido
            x_pt = x_mm * MM_A_PT
            w_pt = w_mm * MM_A_PT
            h_pt = h_mm * MM_A_PT
            y_pt = (alto_mm - y_mm - h_mm) * MM_A_PT

            raw_fill = el.get('fill') or props.get('fill') or el.get('color') or props.get('color')
            fill_color = resolver_color_elemento(raw_fill, '#1f3a5f')

            stroke_raw = el.get('stroke') or props.get('stroke')
            sw_mm = float(el.get('sw', 0) or props.get('sw', 0))
            sw_pt = sw_mm * MM_A_PT
            tiene_stroke = sw_pt > 0 and stroke_raw

            c.saveState()
            c.setFillColor(fill_color)
            if tiene_stroke:
                c.setStrokeColor(_hex_seguro(stroke_raw, '#111827'))
                c.setLineWidth(sw_pt)

            rad_mm = float(el.get('rad', 0) or props.get('rad', 0) or el.get('radius', 0))
            rad_pt = rad_mm * MM_A_PT

            # Renderizado por tipo de primitiva gráfica
            if tipo in ('rect', 'forma'):
                c.roundRect(x_pt, y_pt, w_pt, h_pt, rad_pt, fill=1, stroke=1 if tiene_stroke else 0)

            elif tipo in ('circle', 'ellipse'):
                c.ellipse(x_pt, y_pt, x_pt + w_pt, y_pt + h_pt, fill=1, stroke=1 if tiene_stroke else 0)

            elif tipo == 'tri':
                path = c.beginPath()
                path.moveTo(x_pt, y_pt)
                path.lineTo(x_pt + w_pt / 2, y_pt + h_pt)
                path.lineTo(x_pt + w_pt, y_pt)
                path.close()
                c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)

            elif tipo == 'diag':
                # Franja superior/inferior diagonal
                path = c.beginPath()
                path.moveTo(x_pt, y_pt + h_pt)
                path.lineTo(x_pt + w_pt, y_pt + h_pt)
                path.lineTo(x_pt + w_pt * 0.72, y_pt)
                path.lineTo(x_pt, y_pt)
                path.close()
                c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)

            elif tipo == 'diagr':
                # Acento diagonal opuesto
                path = c.beginPath()
                path.moveTo(x_pt + w_pt * 0.28, y_pt + h_pt)
                path.lineTo(x_pt + w_pt, y_pt + h_pt)
                path.lineTo(x_pt + w_pt, y_pt)
                path.lineTo(x_pt, y_pt)
                path.close()
                c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)

            elif tipo in ('line', 'signline'):
                c.setLineWidth(max(h_pt, 0.4))
                c.setStrokeColor(fill_color)
                c.line(x_pt, y_pt + h_pt / 2, x_pt + w_pt, y_pt + h_pt / 2)

            elif tipo == 'photo':
                _dibujar_foto(c, foto_bytes, x_pt, y_pt, w_pt, h_pt, rad_pt)

            elif tipo == 'qr':
                _dibujar_qr(c, datos_dict, x_pt, y_pt, tamano=min(w_pt, h_pt))

            elif tipo == 'image':
                # Logo o firma: si el elemento trae un asset institucional, se
                # dibuja la imagen; si no, se conserva el marcador de texto.
                label = props.get('label') or el.get('name') or 'LOGO'
                ruta = ruta_asset(props.get('asset')) if props.get('asset') else None
                dibujado = False
                if ruta:
                    try:
                        c.drawImage(
                            ImageReader(ruta), x_pt, y_pt, w_pt, h_pt,
                            preserveAspectRatio=True, anchor='c', mask='auto',
                        )
                        dibujado = True
                    except Exception:
                        logger.warning("No se pudo dibujar el asset '%s' del carnet.", props.get('asset'))
                if not dibujado:
                    c.setStrokeColor(fill_color)
                    c.setLineWidth(0.6)
                    c.roundRect(x_pt, y_pt, w_pt, h_pt, 1, fill=0, stroke=1)
                    c.setFont(FUENTE_NEGRITA, min(h_pt * 0.45, 7))
                    c.drawCentredString(x_pt + w_pt / 2, y_pt + (h_pt - 5) / 2, label)

            elif tipo in ('text', 'field'):
                # Resolución de cadena de texto
                if tipo == 'field':
                    campo = el.get('campo') or el.get('field') or ''
                    texto_render = _extraer_valor_campo(campo, datos_dict)
                    if not texto_render:
                        texto_render = el.get('nombre') or el.get('name') or ''
                else:
                    texto_render = el.get('texto') or el.get('text') or ''

                if el.get('upper'):
                    texto_render = texto_render.upper()

                font_size = float(el.get('fontSize') or el.get('size') or 7.5)
                bold = bool(el.get('bold', False))
                fuente_elegida = FUENTE_NEGRITA if bold else FUENTE
                c.setFont(fuente_elegida, font_size)
                c.setFillColor(fill_color)

                align = el.get('align', 'left')

                # Si el texto es multilínea (ej. Normas de uso)
                if '\n' in texto_render:
                    lineas = texto_render.split('\n')
                    interlineado = font_size * 1.2
                    total_h = len(lineas) * interlineado
                    y_actual = y_pt + h_pt - (h_pt - total_h) / 2 - font_size
                    for linea in lineas:
                        if align == 'center':
                            c.drawCentredString(x_pt + w_pt / 2, y_actual, linea)
                        elif align == 'right':
                            c.drawRightString(x_pt + w_pt, y_actual, linea)
                        else:
                            c.drawString(x_pt, y_actual, linea)
                        y_actual -= interlineado
                else:
                    y_base = y_pt + (h_pt - font_size) / 2 + 0.5
                    if align == 'center':
                        c.drawCentredString(x_pt + w_pt / 2, y_base, texto_render)
                    elif align == 'right':
                        c.drawRightString(x_pt + w_pt, y_base, texto_render)
                    else:
                        c.drawString(x_pt, y_base, texto_render)

            c.restoreState()

        # Finalizar cara actual
        if idx_cara < len(caras) - 1:
            c.showPage()

    c.save()
    return buffer.getvalue()


def generar_carnet_pdf(datos: DatosCarnetPdf, definicion: dict[str, Any] | None = None) -> bytes:
    """
    Función fachada retrocompatible.
    Si se suministra una definición JSON (o se recurre a la plantilla por defecto),
    invoca el motor fiel de 2 caras (O44 - E8).
    Si se solicita la plantilla legada en imagen fija con datos.plantilla_path, conserva
    el renderizado de compatibilidad previa.
    """
    if definicion is not None:
        return generar_carnet_pdf_fiel(definicion, datos)

    # Si hay una imagen fija legada explícita y no hay definición nueva, usar el layout previo
    if datos.plantilla_path and not definicion:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=(CARNET_WIDTH, CARNET_HEIGHT))
        try:
            c.drawImage(ImageReader(datos.plantilla_path), 0, 0, CARNET_WIDTH, CARNET_HEIGHT, preserveAspectRatio=False, anchor="c")
        except Exception:
            c.rect(0, 0, CARNET_WIDTH, CARNET_HEIGHT, fill=1)

        qr_tamano = 1.2 * cm
        x_qr, y_qr = 0.4 * cm, 0.8 * cm
        _dibujar_qr(c, datos, x_qr, y_qr, tamano=qr_tamano)

        photo_width, photo_height = 2.0 * cm, 2.4 * cm
        x_foto = (CARNET_WIDTH - photo_width) / 2
        y_foto = 4.6 * cm
        _dibujar_foto(c, datos.foto_bytes, x_foto, y_foto, photo_width, photo_height)

        center_x = CARNET_WIDTH / 2
        max_text_width = CARNET_WIDTH - 0.80 * cm
        text_start_y = y_foto - 0.3 * cm
        c.setFont(FUENTE_NEGRITA, 7)
        c.drawCentredString(center_x, text_start_y, datos.nombre_completo.upper()[:30])
        c.setFont(FUENTE, 7)
        c.drawCentredString(center_x, text_start_y - 0.45 * cm, f"C.I: {datos.cedula}")
        c.save()
        return buffer.getvalue()

    # Por defecto en GATH: motor canónico de dos caras de alta fidelidad
    def_canonica = plantilla_defecto_trabajador()
    return generar_carnet_pdf_fiel(def_canonica, datos)
