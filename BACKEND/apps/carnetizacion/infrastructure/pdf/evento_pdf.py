"""
Generador del PDF del Gafete de Evento (90 x 130 mm, dos caras) (Regla B2/B3, O45-B).
"""
from io import BytesIO
from typing import Any

import qrcode
import qrcode.constants
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.entities.evento import (
    Evento,
    EventoCategoria,
    EventoInvitado,
    EventoZona,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import MM_A_PT, _hex_seguro


def _dibujar_qr_evento(
    c: canvas.Canvas,
    security_hash: str,
    codigo: str,
    nombre: str,
    x: float,
    y: float,
    tamano: float = 2.8 * cm,
) -> None:
    contenido = (
        f"EVENTO-ID: {security_hash}\n"
        f"COD: {codigo}\n"
        f"Asistente: {str(nombre)[:35]}\n"
    )
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=3,
        border=1,
    )
    qr.add_data(contenido)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color="black", back_color="white")

    buf = BytesIO()
    img_qr.save(buf, format="PNG")
    buf.seek(0)
    reader = ImageReader(buf)
    c.drawImage(reader, x, y, width=tamano, height=tamano)


def _dibujar_gafete_paginas(
    c: canvas.Canvas,
    invitado: EventoInvitado,
    evento: Evento,
    categoria: EventoCategoria | None = None,
    zona: EventoZona | None = None,
    ancho_mm: float = 90.0,
    alto_mm: float = 130.0,
) -> None:
    width_pt = ancho_mm * MM_A_PT
    height_pt = alto_mm * MM_A_PT

    primario = _hex_seguro(categoria.color_primario if categoria else "#0B4A9E")
    acento = _hex_seguro(categoria.color_acento if categoria else "#F59E0B")
    blanco = HexColor("#FFFFFF")
    oscuro = HexColor("#111827")
    gris = HexColor("#4B5563")

    # ══════════════════════════════════════════════════════════════════
    # PÁGINA 1: ANVERSO
    # ══════════════════════════════════════════════════════════════════

    # 1. Fondo superior
    c.setFillColor(primario)
    sup_h = 34.0 * MM_A_PT
    c.rect(0, height_pt - sup_h, width_pt, sup_h, stroke=0, fill=1)

    # 2. Identificación institucional
    c.setFillColor(blanco)
    c.setFont(FUENTE_NEGRITA, 10)
    c.drawString(8 * MM_A_PT, height_pt - 10 * MM_A_PT, "CONATEL")
    c.setFont(FUENTE, 6.5)
    c.drawString(8 * MM_A_PT, height_pt - 15 * MM_A_PT, "Comisión Nacional de Telecomunicaciones")

    # 3. Nombre del Evento
    c.setFont(FUENTE_NEGRITA, 12)
    ev_nombre = (evento.nombre or "EVENTO INSTITUCIONAL").upper()
    c.drawString(8 * MM_A_PT, height_pt - 26 * MM_A_PT, ev_nombre[:40])

    # 4. Nombre del Asistente
    c.setFillColor(oscuro)
    c.setFont(FUENTE_NEGRITA, 14)
    nom = invitado.nombre_completo or "Invitado"
    c.drawCentredString(width_pt / 2.0, height_pt - 46 * MM_A_PT, nom[:35])

    # 5. Organización
    c.setFillColor(gris)
    c.setFont(FUENTE, 9)
    org = invitado.organizacion or "Invitado(a)"
    c.drawCentredString(width_pt / 2.0, height_pt - 55 * MM_A_PT, org[:40])

    # 6. Banda de Categoría
    c.setFillColor(acento)
    banda_y = height_pt - 72 * MM_A_PT
    banda_h = 13 * MM_A_PT
    c.rect(0, banda_y, width_pt, banda_h, stroke=0, fill=1)

    c.setFillColor(blanco)
    c.setFont(FUENTE_NEGRITA, 12)
    cat_nom = (categoria.nombre if categoria else "INVITADO").upper()
    c.drawCentredString(width_pt / 2.0, banda_y + 4 * MM_A_PT, cat_nom)

    # 7. Código QR del Invitado
    qr_tamano = 28 * MM_A_PT
    qr_x = 8 * MM_A_PT
    qr_y = height_pt - 110 * MM_A_PT
    _dibujar_qr_evento(
        c,
        security_hash=invitado.security_hash,
        codigo=invitado.codigo_credencial,
        nombre=invitado.nombre_completo,
        x=qr_x,
        y=qr_y,
        tamano=qr_tamano,
    )

    # 8. Detalles del Evento (Fecha, Zona, Mesa, Código)
    detalles_x = 40 * MM_A_PT
    c.setFillColor(oscuro)
    c.setFont(FUENTE_NEGRITA, 8)
    c.drawString(detalles_x, height_pt - 88 * MM_A_PT, "Fecha:")
    c.setFont(FUENTE, 8)
    fecha_txt = evento.fecha_inicio.strftime("%d/%m/%Y") if evento.fecha_inicio else ""
    c.drawString(detalles_x + 12 * MM_A_PT, height_pt - 88 * MM_A_PT, fecha_txt)

    c.setFont(FUENTE_NEGRITA, 8)
    c.drawString(detalles_x, height_pt - 96 * MM_A_PT, "Zona:")
    c.setFont(FUENTE, 8)
    zona_txt = zona.nombre if zona else "General"
    c.drawString(detalles_x + 12 * MM_A_PT, height_pt - 96 * MM_A_PT, zona_txt[:25])

    c.setFont(FUENTE_NEGRITA, 8)
    c.drawString(detalles_x, height_pt - 104 * MM_A_PT, "Mesa:")
    c.setFont(FUENTE, 8)
    mesa_txt = invitado.mesa or "Sin mesa"
    c.drawString(detalles_x + 12 * MM_A_PT, height_pt - 104 * MM_A_PT, mesa_txt[:20])

    c.setFont(FUENTE_NEGRITA, 8)
    c.drawString(detalles_x, height_pt - 112 * MM_A_PT, "Código:")
    c.setFont(FUENTE, 8)
    c.drawString(detalles_x + 12 * MM_A_PT, height_pt - 112 * MM_A_PT, invitado.codigo_credencial)

    # Pie anverso
    c.setFillColor(HexColor("#9CA3AF"))
    c.setFont(FUENTE, 6)
    c.drawCentredString(width_pt / 2.0, 5 * MM_A_PT, "Presente este gafete en el punto de control de acceso")

    c.showPage()

    # ══════════════════════════════════════════════════════════════════
    # PÁGINA 2: REVERSO
    # ══════════════════════════════════════════════════════════════════

    # Franja superior reverso
    c.setFillColor(primario)
    c.rect(0, height_pt - 14 * MM_A_PT, width_pt, 14 * MM_A_PT, stroke=0, fill=1)
    c.setFillColor(blanco)
    c.setFont(FUENTE_NEGRITA, 8)
    c.drawCentredString(width_pt / 2.0, height_pt - 10 * MM_A_PT, "NORMAS E INSTRUCCIONES DE ACCESO")

    # Indicaciones
    c.setFillColor(oscuro)
    c.setFont(FUENTE, 8)
    indicaciones = [
        "•  Presente esta credencial obligatoriamente al ingresar al evento.",
        "•  Esta credencial es de carácter personal e intransferible.",
        "•  Consérvela en lugar visible durante todo el desarrollo de la jornada.",
        "•  El código QR es único y valida su autorización de entrada.",
        "•  Respete la zona y mesa asignadas por el comité organizador.",
    ]
    cur_y = height_pt - 26 * MM_A_PT
    for ind in indicaciones:
        c.drawString(8 * MM_A_PT, cur_y, ind)
        cur_y -= 8 * MM_A_PT

    # QR de respaldo centrado
    qr_rev_tamano = 30 * MM_A_PT
    qr_rev_x = (width_pt - qr_rev_tamano) / 2.0
    qr_rev_y = 25 * MM_A_PT
    _dibujar_qr_evento(
        c,
        security_hash=invitado.security_hash,
        codigo=invitado.codigo_credencial,
        nombre=invitado.nombre_completo,
        x=qr_rev_x,
        y=qr_rev_y,
        tamano=qr_rev_tamano,
    )

    # Pie reverso
    c.setFillColor(gris)
    c.setFont(FUENTE_NEGRITA, 7)
    c.drawCentredString(width_pt / 2.0, 12 * MM_A_PT, "Comisión Nacional de Telecomunicaciones — CONATEL")

    c.showPage()


def generar_gafete_evento_pdf(
    invitado: EventoInvitado,
    evento: Evento,
    categoria: EventoCategoria | None = None,
    zona: EventoZona | None = None,
    ancho_mm: float = 90.0,
    alto_mm: float = 130.0,
    host_base: str = "",
) -> bytes:
    """
    Genera un documento PDF de 2 páginas (anverso y reverso) del gafete de evento.
    Medida canónica: 90 x 130 mm.
    """
    buffer = BytesIO()
    width_pt = ancho_mm * MM_A_PT
    height_pt = alto_mm * MM_A_PT

    c = canvas.Canvas(buffer, pagesize=(width_pt, height_pt))
    _dibujar_gafete_paginas(c, invitado, evento, categoria, zona, ancho_mm, alto_mm)
    c.save()

    buffer.seek(0)
    return buffer.getvalue()


def generar_lote_gafetes_evento_pdf(
    invitados: list[EventoInvitado],
    evento: Evento,
    categorias_map: dict[str, EventoCategoria] | None = None,
    zonas_map: dict[str, EventoZona] | None = None,
    ancho_mm: float = 90.0,
    alto_mm: float = 130.0,
    host_base: str = "",
) -> bytes:
    """
    Genera un lote multi-página con los gafetes de todos los invitados de un evento.
    """
    buffer = BytesIO()
    width_pt = ancho_mm * MM_A_PT
    height_pt = alto_mm * MM_A_PT

    c = canvas.Canvas(buffer, pagesize=(width_pt, height_pt))

    for inv in invitados:
        cat = categorias_map.get(str(inv.categoria_id)) if categorias_map else None
        zn = zonas_map.get(str(inv.zona_id)) if zonas_map else None
        _dibujar_gafete_paginas(c, inv, evento, cat, zn, ancho_mm, alto_mm)

    c.save()
    buffer.seek(0)
    return buffer.getvalue()
