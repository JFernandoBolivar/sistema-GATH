"""Motor `pdf_overlay` (formato de terceros): páginas del PDF oficial como fondo y valores estampados encima (F-2).

El fondo se rasteriza con el mismo rasterizador del carnet (`core.infrastructure.pdf.rasterizar_pdf`: límites de K-4,
Poppler) y se dibuja a página completa; encima van los campos en milímetros desde la esquina superior izquierda.
"""
from io import BytesIO

from PIL import Image
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from apps.documentos.domain.services.variables_documento import sustituir, valor_de
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.pdf_components import reducir_imagen_para_pdf
from core.infrastructure.pdf.rasterizar_pdf import rasterizar_pagina_pdf

TAMANO_MINIMO = 5.0


def condicion_cumplida(cond: dict, datos: dict) -> bool:
    actual = valor_de(cond['variable'], datos).strip().lower()
    esperado = (cond.get('valor') or '').strip().lower()
    op = cond.get('operador', 'igual')
    if op == 'igual':
        return bool(actual) and actual == esperado
    if op == 'distinto':
        return actual != esperado
    if op == 'no_vacio':
        return bool(actual)
    return not actual  # vacio


def _recortar(texto: str, fuente: str, tamano: float, ancho: float) -> str:
    if stringWidth(texto, fuente, tamano) <= ancho:
        return texto
    while texto and stringWidth(texto + '…', fuente, tamano) > ancho:
        texto = texto[:-1]
    return texto.rstrip() + '…' if texto else ''


def _texto_en_caja(c, texto: str, x: float, y_sup: float, w: float, h: float, tamano: float, alineacion: str, negrita: bool):
    """Dibuja `texto` en la caja (pt, y_sup = borde superior en coordenadas PDF), reduciendo la letra si no cabe."""
    if not texto:
        return
    fuente = FUENTE_NEGRITA if negrita else FUENTE
    while tamano > TAMANO_MINIMO and stringWidth(texto, fuente, tamano) > w:
        tamano -= 0.5
    texto = _recortar(texto, fuente, tamano, w)
    c.setFont(fuente, tamano)
    base = y_sup - h / 2 - tamano * 0.35
    if alineacion == 'centro':
        c.drawCentredString(x + w / 2, base, texto)
    elif alineacion == 'derecha':
        c.drawRightString(x + w, base, texto)
    else:
        c.drawString(x, base, texto)


def _fondo_jpeg(png: bytes) -> BytesIO:
    with Image.open(BytesIO(png)) as img:
        salida = BytesIO()
        img.convert('RGB').save(salida, 'JPEG', quality=85, optimize=True)
    salida.seek(0)
    return salida


def _dibujar_campo(c, campo: dict, datos: dict, alto_pagina: float, vista_previa: bool):
    x, w, h = campo['x'] * mm, campo['w'] * mm, campo['h'] * mm
    y_sup = alto_pagina - campo['y'] * mm
    tipo = campo['tipo']
    c.setFillColorRGB(0, 0, 0)
    if tipo == 'texto':
        _texto_en_caja(c, sustituir(campo['texto'], datos).replace('\n', ' '), x, y_sup, w, h, campo['tamano'],
                       campo['alineacion'], campo['negrita'])
    elif tipo == 'casilla':
        if condicion_cumplida(campo['condicion'], datos):
            lado = min(w, h)
            c.setFont(FUENTE_NEGRITA, lado * 0.8)
            c.drawCentredString(x + w / 2, y_sup - h / 2 - lado * 0.28, 'X')
    elif tipo == 'foto':
        foto = datos.get('foto') if isinstance(datos.get('foto'), (bytes, bytearray)) else None
        if foto:
            try:
                c.drawImage(ImageReader(BytesIO(reducir_imagen_para_pdf(bytes(foto), 600))), x, y_sup - h, w, h,
                            preserveAspectRatio=True, anchor='c', mask='auto')
            except Exception:  # noqa: BLE001 - una foto dañada no debe tumbar el documento
                pass
        elif vista_previa:
            c.setStrokeColorRGB(0.4, 0.4, 0.4)
            c.setDash(2, 2)
            c.rect(x, y_sup - h, w, h)
            c.setDash()
            c.setFont(FUENTE, 7)
            c.drawCentredString(x + w / 2, y_sup - h / 2, 'FOTO')
    elif tipo == 'tabla':
        filas = (datos.get(campo['coleccion']) or [])[:campo['filas_max']]
        paso = campo['interlineado'] * mm
        for i, fila in enumerate(filas):
            for col in campo['columnas']:
                _texto_en_caja(c, str(fila.get(col['variable'], '') or ''), x + col['dx'] * mm, y_sup - i * paso,
                               col['ancho'] * mm, paso, campo['tamano'], col['alineacion'], False)


def renderizar_overlay(contexto: dict, datos: dict) -> bytes:
    definicion = contexto['definicion']
    dimensiones = {p['numero']: p for p in contexto['fondo_paginas']}
    pdf_fondo = contexto['fondo_pdf']
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pageCompression=1)
    c.setTitle(contexto.get('titulo') or 'Documento')
    c.setAuthor('CONATEL')
    for pagina in definicion['paginas']:
        dim = dimensiones[pagina['origen']]
        ancho, alto = dim['ancho_pt'], dim['alto_pt']
        c.setPageSize((ancho, alto))
        c.drawImage(ImageReader(_fondo_jpeg(rasterizar_pagina_pdf(pdf_fondo, pagina['origen']))), 0, 0, ancho, alto)
        for campo in pagina['campos']:
            _dibujar_campo(c, campo, datos, alto, bool(contexto.get('vista_previa')))
        c.showPage()
    c.save()
    return buffer.getvalue()
