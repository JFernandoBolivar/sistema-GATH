"""
Impresión por lote de credenciales (O45-A).

Genera hojas A4 con varias credenciales (anverso en una hoja y reverso en la
siguiente) y marcas de corte. Cada tarjeta se dibuja con `dibujar_cara`, el mismo
dibujador del PDF individual: un diseño sale idéntico por ambas vías.
"""
from io import BytesIO
from typing import Any

from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    MM_A_PT,
    dibujar_cara,
    dimensiones_mm,
)

A4_ANCHO = 210 * MM_A_PT
A4_ALTO = 297 * MM_A_PT
MARGEN = 10 * MM_A_PT
SEPARACION = 4 * MM_A_PT
COLUMNAS = 3
FILAS = 3


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
    ancho_mm, alto_mm = dimensiones_mm(tarjetas[0]['definicion'])
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
                dibujar_cara(c, tarjeta['definicion'], tarjeta['datos'], cara, x, y)
                _marcas_corte(c, x, y, ancho_pt, alto_pt)
            c.showPage()

    c.save()
    return buffer.getvalue()
