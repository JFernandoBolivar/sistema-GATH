"""
Impresión por lote de credenciales (O45-A).

Genera hojas A4 con varias credenciales (anverso en una hoja y reverso en la
siguiente), marcas de corte y la misma definición JSON del motor de O44.
"""
from io import BytesIO
from typing import Any

from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.services.resolver_color import resolver_color_carnet
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    MM_A_PT,
    _dibujar_foto,
    _dibujar_qr,
    _dibujar_svg_path,
    _extraer_valor_campo,
    _hex_seguro,
)
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.pdf_components import ruta_asset

A4_ANCHO = 210 * MM_A_PT
A4_ALTO = 297 * MM_A_PT
MARGEN = 10 * MM_A_PT
SEPARACION = 4 * MM_A_PT
COLUMNAS = 3
FILAS = 3


def _dibujar_cara(
    c: canvas.Canvas,
    definicion: dict[str, Any],
    datos: dict[str, Any],
    cara: str,
    x_offset: float,
    y_offset: float,
    ancho_pt: float,
    alto_pt: float,
) -> None:
    dims = definicion.get('dimensiones', {})
    ancho_mm = float(definicion.get('ancho_mm') or dims.get('ancho_mm') or 54.0)
    alto_mm = float(definicion.get('alto_mm') or dims.get('alto_mm') or 85.6)
    colores = resolver_color_carnet(definicion, datos)

    def color(valor: str | None, defecto: str = '#111827') -> HexColor:
        if valor == 'rule:primario':
            return _hex_seguro(colores.get('primario'), '#1f3a5f')
        if valor == 'rule:acento':
            return _hex_seguro(colores.get('acento'), '#1273bd')
        if valor == 'rule:texto':
            return _hex_seguro(colores.get('texto'), '#ffffff')
        return _hex_seguro(valor, defecto)

    if 'anverso' in definicion and 'reverso' in definicion:
        elementos = definicion.get(cara, [])
    else:
        elementos = [
            e
            for e in definicion.get('elementos', [])
            if e.get('cara', 'anverso') == cara
        ]

    bg = definicion.get('bg', {})
    fondo = bg.get(cara, '#ffffff') if isinstance(bg, dict) else '#ffffff'
    c.setFillColor(_hex_seguro(fondo, '#ffffff'))
    c.rect(x_offset, y_offset, ancho_pt, alto_pt, fill=1, stroke=0)

    foto_bytes = datos.get('foto_bytes')
    for el in elementos:
        if el.get('oculto') or el.get('hidden'):
            continue
        tipo = el.get('tipo') or el.get('t')
        props = el.get('props', {})
        x_mm = float(el.get('x', 0))
        y_mm = float(el.get('y', 0))
        w_mm = float(el.get('w', 10))
        h_mm = float(el.get('h', 10))
        x_pt = x_offset + x_mm * MM_A_PT
        w_pt = w_mm * MM_A_PT
        h_pt = h_mm * MM_A_PT
        y_pt = y_offset + (alto_mm - y_mm - h_mm) * MM_A_PT

        relleno = color(
            el.get('fill') or props.get('fill') or el.get('color') or props.get('color'),
            '#1f3a5f',
        )
        stroke_raw = el.get('stroke') or props.get('stroke')
        sw_pt = float(el.get('sw', 0) or props.get('sw', 0)) * MM_A_PT
        tiene_stroke = sw_pt > 0 and bool(stroke_raw)

        c.saveState()
        c.setFillColor(relleno)
        if tiene_stroke:
            c.setStrokeColor(_hex_seguro(stroke_raw, '#111827'))
            c.setLineWidth(sw_pt)
        rad_pt = float(el.get('rad', 0) or props.get('rad', 0) or el.get('radius', 0)) * MM_A_PT

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
            path = c.beginPath()
            path.moveTo(x_pt, y_pt + h_pt)
            path.lineTo(x_pt + w_pt, y_pt + h_pt)
            path.lineTo(x_pt + w_pt * 0.72, y_pt)
            path.lineTo(x_pt, y_pt)
            path.close()
            c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)
        elif tipo == 'diagr':
            path = c.beginPath()
            path.moveTo(x_pt + w_pt * 0.28, y_pt + h_pt)
            path.lineTo(x_pt + w_pt, y_pt + h_pt)
            path.lineTo(x_pt + w_pt, y_pt)
            path.lineTo(x_pt, y_pt)
            path.close()
            c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)
        elif tipo == 'path':
            _dibujar_svg_path(
                c,
                el.get('path') or props.get('d'),
                x_pt, y_pt, w_pt, h_pt,
                relleno,
                stroke_raw if tiene_stroke else None,
                sw_pt,
            )
        elif tipo in ('line', 'signline'):
            c.setLineWidth(max(h_pt, 0.4))
            c.setStrokeColor(relleno)
            c.line(x_pt, y_pt + h_pt / 2, x_pt + w_pt, y_pt + h_pt / 2)
        elif tipo == 'photo':
            _dibujar_foto(c, foto_bytes, x_pt, y_pt, w_pt, h_pt, rad_pt)
        elif tipo == 'qr':
            _dibujar_qr(
                c, datos, x_pt, y_pt,
                tamano=min(w_pt, h_pt),
                con_logo=bool(props.get('logo', True)),
            )
        elif tipo == 'image':
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
                    pass
            if not dibujado:
                c.setStrokeColor(relleno)
                c.setLineWidth(0.6)
                c.roundRect(x_pt, y_pt, w_pt, h_pt, 1, fill=0, stroke=1)
                c.setFont(FUENTE_NEGRITA, min(h_pt * 0.45, 7))
                c.drawCentredString(x_pt + w_pt / 2, y_pt + (h_pt - 5) / 2, label)
        elif tipo in ('text', 'field'):
            if tipo == 'field':
                texto = _extraer_valor_campo(
                    el.get('campo') or el.get('field') or '', datos
                ) or el.get('nombre') or el.get('name') or ''
            else:
                texto = el.get('texto') or el.get('text') or ''
            if el.get('upper'):
                texto = texto.upper()
            font_size = float(el.get('fontSize') or el.get('size') or 7.5)
            c.setFont(FUENTE_NEGRITA if el.get('bold') else FUENTE, font_size)
            c.setFillColor(relleno)
            align = el.get('align', 'left')
            if '\n' in texto:
                lineas = texto.split('\n')
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
                    c.drawCentredString(x_pt + w_pt / 2, y_base, texto)
                elif align == 'right':
                    c.drawRightString(x_pt + w_pt, y_base, texto)
                else:
                    c.drawString(x_pt, y_base, texto)
        c.restoreState()


def _marcas_corte(c: canvas.Canvas, x: float, y: float, ancho: float, alto: float) -> None:
    c.saveState()
    c.setStrokeColor(HexColor('#9ca3af'))
    c.setLineWidth(0.3)
    c.setDash(2, 2)
    c.rect(x, y, ancho, alto, fill=0, stroke=1)
    c.setDash()
    largo = 4 * MM_A_PT
    for px, py in ((x, y), (x + ancho, y), (x, y + alto), (x + ancho, y + alto)):
        c.line(px - largo, py, px + largo, py)
        c.line(px, py - largo, px, py + largo)
    c.restoreState()


def generar_pdf_lote(tarjetas: list[dict[str, Any]]) -> bytes:
    """Devuelve un PDF A4: una hoja de anversos y otra de reversos, 9 por hoja."""
    if not tarjetas:
        raise ValueError('El lote no contiene credenciales.')
    primera = tarjetas[0]['definicion']
    dims = primera.get('dimensiones', {})
    ancho_mm = float(primera.get('ancho_mm') or dims.get('ancho_mm') or 54.0)
    alto_mm = float(primera.get('alto_mm') or dims.get('alto_mm') or 85.6)
    ancho_pt = ancho_mm * MM_A_PT
    alto_pt = alto_mm * MM_A_PT

    total_ancho = COLUMNAS * ancho_pt + (COLUMNAS - 1) * SEPARACION
    total_alto = FILAS * alto_pt + (FILAS - 1) * SEPARACION
    inicio_x = (A4_ANCHO - total_ancho) / 2
    inicio_y = (A4_ALTO - total_alto) / 2

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(A4_ANCHO, A4_ALTO), pageCompression=0)
    c.setAuthor('GATH - Sistema de Carnetización Institucional')
    c.setTitle('Lote de credenciales')
    c.setSubject('Credenciales institucionales para impresión')

    # Una hoja por cada bloque de 9; anverso y reverso por separado.
    for cara in ('anverso', 'reverso'):
        for bloque_inicio in range(0, len(tarjetas), COLUMNAS * FILAS):
            bloque = tarjetas[bloque_inicio:bloque_inicio + COLUMNAS * FILAS]
            for indice, tarjeta in enumerate(bloque):
                col = indice % COLUMNAS
                row = indice // COLUMNAS
                x = inicio_x + col * (ancho_pt + SEPARACION)
                y = A4_ALTO - inicio_y - (row + 1) * alto_pt - row * SEPARACION
                _dibujar_cara(
                    c, tarjeta['definicion'], tarjeta['datos'], cara,
                    x, y, ancho_pt, alto_pt,
                )
                _marcas_corte(c, x, y, ancho_pt, alto_pt)
            c.showPage()

    c.save()
    return buffer.getvalue()
