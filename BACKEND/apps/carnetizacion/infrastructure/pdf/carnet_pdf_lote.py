"""
Impresión por lote de credenciales (O45-A).

Genera hojas A4 con varias credenciales (anversos de una hoja y, a continuación, sus
reversos) y marcas de corte. Cada tarjeta se dibuja con `dibujar_cara`, el mismo
dibujador del PDF individual: un diseño sale idéntico por ambas vías.
"""
from io import BytesIO
from typing import Any

from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.value_objects.modo_duplex import (
    BORDE_CORTO,
    BORDE_LARGO,
    MODOS,
    SIN_ESPEJO,
)
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


def _caras_de(definicion: dict[str, Any]) -> tuple[str, ...]:
    """Caras que tiene el diseño: la plantilla LEGACY declara solo el anverso."""
    declaradas = tuple(c for c in (definicion.get('caras') or ('anverso', 'reverso')) if c in ('anverso', 'reverso'))
    return declaradas or ('anverso', 'reverso')


def generar_pdf_lote(tarjetas: list[dict[str, Any]], modo_duplex: str = SIN_ESPEJO) -> bytes:
    """PDF A4 con 9 credenciales por cara y marcas de corte.

    K-1: las páginas van intercaladas por hoja (anversos de la hoja 1, reversos de la hoja 1,
    anversos de la hoja 2…), así al imprimir a doble cara cada reverso cae detrás de su
    anverso aunque el lote tenga más de 9 tarjetas. `modo_duplex` espeja la página de
    reversos: sin espejo, borde largo (invierte columnas) o borde corto (invierte filas).
    Si ninguna tarjeta de la hoja tiene reverso (LEGACY de una cara), no se agrega una
    página de reversos en blanco. Todas las tarjetas deben tener el mismo tamaño.
    """
    if not tarjetas:
        raise ValueError('El lote no contiene credenciales.')
    if modo_duplex not in MODOS:
        raise ValueError(f'Modo de impresión no válido: {modo_duplex}')

    ancho_mm, alto_mm = dimensiones_mm(tarjetas[0]['definicion'])
    if any(dimensiones_mm(t['definicion']) != (ancho_mm, alto_mm) for t in tarjetas[1:]):
        raise ValueError(
            'El lote mezcla carnets de distinto tamaño u orientación; genere un lote por cada formato.'
        )
    ancho_pt = ancho_mm * MM_A_PT
    alto_pt = alto_mm * MM_A_PT

    total_ancho = COLUMNAS * ancho_pt + (COLUMNAS - 1) * SEPARACION
    total_alto = FILAS * alto_pt + (FILAS - 1) * SEPARACION
    if total_ancho > A4_ANCHO - 2 * MARGEN or total_alto > A4_ALTO - 2 * MARGEN:
        raise ValueError(
            'El formato del carnet no cabe 3 x 3 en una hoja A4 vertical; use el carnet individual.'
        )
    inicio_x = (A4_ANCHO - total_ancho) / 2
    inicio_y = (A4_ALTO - total_alto) / 2

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(A4_ANCHO, A4_ALTO), pageCompression=0)
    c.setAuthor('GATH - Sistema de Carnetización Institucional')
    c.setTitle('Lote de credenciales')
    c.setSubject('Credenciales institucionales para impresión')

    por_hoja = COLUMNAS * FILAS
    for bloque_inicio in range(0, len(tarjetas), por_hoja):
        bloque = tarjetas[bloque_inicio:bloque_inicio + por_hoja]
        hay_reverso = any('reverso' in _caras_de(t['definicion']) for t in bloque)
        for cara in ('anverso', 'reverso') if hay_reverso else ('anverso',):
            for indice, tarjeta in enumerate(bloque):
                if cara not in _caras_de(tarjeta['definicion']):
                    continue
                col = indice % COLUMNAS
                row = indice // COLUMNAS
                if cara == 'reverso':
                    if modo_duplex == BORDE_LARGO:
                        col = COLUMNAS - 1 - col
                    elif modo_duplex == BORDE_CORTO:
                        row = FILAS - 1 - row
                x = inicio_x + col * (ancho_pt + SEPARACION)
                y = A4_ALTO - inicio_y - (row + 1) * alto_pt - row * SEPARACION
                dibujar_cara(c, tarjeta['definicion'], tarjeta['datos'], cara, x, y)
                _marcas_corte(c, x, y, ancho_pt, alto_pt)
            c.showPage()

    c.save()
    return buffer.getvalue()
