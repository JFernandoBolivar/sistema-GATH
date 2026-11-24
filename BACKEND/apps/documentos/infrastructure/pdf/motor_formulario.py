"""Motor «formulario propio»: del esquema de bloques a un PDF con ReportLab (F-1).

Reutiliza el cabezal y el pie institucionales (`core.infrastructure.pdf`), la tipografía y la paleta.
"""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Flowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.documentos.domain.services.variables_documento import sustituir, valor_de
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.paleta import AZUL_CONATEL, GRIS_BORDE, GRIS_TEXTO, NEGRO
from core.infrastructure.pdf.pdf_components import create_header, draw_footer, reducir_imagen_para_pdf

OFICIO = (612.0, 936.0)  # 8,5 x 13 in
_ALINEACION = {'izquierda': TA_LEFT, 'centro': TA_CENTER, 'derecha': TA_RIGHT, 'justificado': TA_JUSTIFY}
_ALTO_FILA_MM = 12
_ALTO_FILA_VACIA_MM = 7


def tamano_de_pagina(pagina: dict) -> tuple[float, float]:
    base = OFICIO if pagina.get('tamano') == 'oficio' else letter
    return landscape(base) if pagina.get('orientacion') == 'horizontal' else base


def _estilo(nombre: str, **kw) -> ParagraphStyle:
    kw.setdefault('fontName', FUENTE)
    kw.setdefault('fontSize', 9)
    kw.setdefault('leading', kw['fontSize'] * 1.3)
    kw.setdefault('textColor', NEGRO)
    return ParagraphStyle(nombre, **kw)


class Casilla(Flowable):
    """Opción de casilla: cuadro de 3,2 mm (con «X» si está marcada) y su etiqueta."""

    def __init__(self, etiqueta: str, marcada: bool, ancho: float):
        super().__init__()
        self.etiqueta, self.marcada, self.ancho = etiqueta, marcada, ancho
        self.alto = 4.6 * mm

    def wrap(self, w, h):
        return self.ancho, self.alto

    def draw(self):
        c, lado = self.canv, 3.2 * mm
        c.setStrokeColor(NEGRO)
        c.setLineWidth(0.6)
        c.rect(0, 0.7 * mm, lado, lado)
        if self.marcada:
            c.setFont(FUENTE_NEGRITA, 9)
            c.drawCentredString(lado / 2, 1.1 * mm, 'X')
        c.setFont(FUENTE, 8)
        c.setFillColor(NEGRO)
        c.drawString(lado + 1.6 * mm, 1.1 * mm, self.etiqueta)


class Foto(Flowable):
    """Fotografía (o su marco si aún no hay)."""

    def __init__(self, contenido: bytes | None, ancho: float, alto: float):
        super().__init__()
        self.contenido, self.ancho, self.alto = contenido, ancho, alto

    def wrap(self, w, h):
        return self.ancho, self.alto

    def draw(self):
        c = self.canv
        if self.contenido:
            try:
                c.drawImage(ImageReader(BytesIO(reducir_imagen_para_pdf(self.contenido, 600))), 0, 0,
                            self.ancho, self.alto, preserveAspectRatio=True, anchor='c', mask='auto')
                return
            except Exception:  # noqa: BLE001 - una foto dañada no debe tumbar el documento
                pass
        c.setStrokeColor(GRIS_TEXTO)
        c.setDash(2, 2)
        c.rect(0, 0, self.ancho, self.alto)
        c.setDash()
        c.setFont(FUENTE, 7)
        c.setFillColor(GRIS_TEXTO)
        c.drawCentredString(self.ancho / 2, self.alto / 2, 'FOTO')


def _p(texto: str, estilo: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(texto).replace('\n', '<br/>'), estilo)


def _repartir(pesos: list[float], total: float) -> list[float]:
    suma = sum(pesos) or 1
    return [total * p / suma for p in pesos]


def _bloque_seccion(b, ancho, datos, e):
    t = Table([[_p(b['titulo'].upper(), e['seccion'])]], colWidths=[ancho])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), AZUL_CONATEL), ('TOPPADDING', (0, 0), (-1, -1), 3),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LEFTPADDING', (0, 0), (-1, -1), 6)]))
    return [Spacer(1, 2 * mm), t]


def _bloque_fila(b, ancho, datos, e):
    anchos = _repartir([c['ancho'] for c in b['celdas']], ancho)
    celdas, alto = [], b.get('alto_mm', _ALTO_FILA_MM) * mm
    for c, ancho_col in zip(b['celdas'], anchos):
        partes = []
        if c['etiqueta']:
            partes.append(Paragraph(escape(c['etiqueta']), e['etiqueta']))
        valor = valor_de(c['variable'], datos)
        if valor:
            partes.append(_p(valor, e['valor']))
        celdas.append(partes or [Spacer(1, 1)])
        # La fila crece si el texto no cabe en el alto mínimo.
        necesario = sum(p.wrap(ancho_col - 8, 10000)[1] for p in partes) + 6 if partes else 0
        alto = max(alto, necesario)
    t = Table([celdas], colWidths=anchos, rowHeights=[alto])
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, GRIS_BORDE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 2)]))
    return [t]


def _bloque_casillas(b, ancho, datos, e):
    actual = valor_de(b['variable'], datos).strip().lower()
    columnas = min(b['columnas'], len(b['opciones']))
    ancho_col = ancho / columnas
    celdas = [Casilla(o['etiqueta'], bool(actual) and actual == o['valor'].strip().lower(), ancho_col - 2 * mm)
              for o in b['opciones']]
    filas = [celdas[i:i + columnas] + [''] * (columnas - len(celdas[i:i + columnas])) for i in range(0, len(celdas), columnas)]
    salida = []
    if b['etiqueta']:
        salida.append(Paragraph(escape(b['etiqueta']), e['etiqueta_suelta']))
    t = Table(filas, colWidths=[ancho_col] * columnas)
    t.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 1),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))
    salida.append(t)
    salida.append(Spacer(1, 1.5 * mm))
    return salida


def _bloque_tabla(b, ancho, datos, e):
    filas_datos = datos.get(b['coleccion']) or []
    cols = b['columnas']
    cuerpo = [[_p(str(f.get(c['variable'], '') or ''), e['celda']) for c in cols] for f in filas_datos]
    cuerpo += [[''] * len(cols) for _ in range(max(0, b['filas_minimas'] - len(cuerpo)))]
    encabezado = [Paragraph(escape(c['etiqueta']), e['th']) for c in cols]
    t = Table([encabezado] + cuerpo, colWidths=_repartir([c['ancho'] for c in cols], ancho), repeatRows=1,
              rowHeights=[None] + [None if i < len(filas_datos) else _ALTO_FILA_VACIA_MM * mm for i in range(len(cuerpo))])
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, GRIS_BORDE), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E8EEF8')),
                           ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 2),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    salida = [Paragraph(escape(b['titulo']), e['etiqueta_suelta'])] if b.get('titulo') else []
    return salida + [t, Spacer(1, 1.5 * mm)]


def _bloque_parrafo(b, ancho, datos, e):
    estilo = ParagraphStyle('par', parent=e['parrafo'], alignment=_ALINEACION[b['alineacion']])
    return [_p(sustituir(b['texto'], datos), estilo), Spacer(1, 1.5 * mm)]


def _bloque_foto(b, ancho, datos, e):
    foto = datos.get('foto') if isinstance(datos.get('foto'), (bytes, bytearray)) else None
    t = Table([[Foto(foto, b['ancho_mm'] * mm, b['alto_mm'] * mm)]], colWidths=[ancho],
              hAlign={'izquierda': 'LEFT', 'centro': 'CENTER', 'derecha': 'RIGHT'}[b['alineacion']])
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), {'izquierda': 'LEFT', 'centro': 'CENTER', 'derecha': 'RIGHT'}[b['alineacion']])]))
    return [t, Spacer(1, 1.5 * mm)]


class Firmas(Flowable):
    """Fila de firmantes: una raya de firma por columna con su etiqueta y detalle debajo."""

    def __init__(self, firmantes: list[dict], ancho: float):
        super().__init__()
        self.firmantes, self.ancho = firmantes, ancho
        self.alto = 24 * mm

    def wrap(self, w, h):
        return self.ancho, self.alto

    def draw(self):
        c, n = self.canv, len(self.firmantes)
        col = self.ancho / n
        c.setStrokeColor(NEGRO)
        c.setLineWidth(0.6)
        for i, f in enumerate(self.firmantes):
            x0, x1 = i * col + 6 * mm, (i + 1) * col - 6 * mm
            c.line(x0, 9 * mm, x1, 9 * mm)
            c.setFillColor(NEGRO)
            c.setFont(FUENTE_NEGRITA, 8)
            c.drawCentredString((x0 + x1) / 2, 5 * mm, f['etiqueta'][:60])
            if f['detalle']:
                c.setFont(FUENTE, 7.5)
                c.setFillColor(GRIS_TEXTO)
                c.drawCentredString((x0 + x1) / 2, 1.5 * mm, f['detalle'][:70])


def _bloque_firmas(b, ancho, datos, e):
    return [Spacer(1, 8 * mm), KeepTogether([Firmas(b['firmantes'], ancho)])]


_BLOQUES = {
    'seccion': _bloque_seccion, 'fila_campos': _bloque_fila, 'casillas': _bloque_casillas, 'tabla': _bloque_tabla,
    'parrafo': _bloque_parrafo, 'foto': _bloque_foto, 'firmas': _bloque_firmas,
}


def _estilos() -> dict:
    return {
        'titulo': _estilo('titulo', fontName=FUENTE_NEGRITA, fontSize=13, alignment=TA_CENTER, spaceAfter=2),
        'subtitulo': _estilo('subtitulo', fontSize=9.5, alignment=TA_CENTER, textColor=GRIS_TEXTO, spaceAfter=4),
        'seccion': _estilo('seccion', fontName=FUENTE_NEGRITA, fontSize=9, textColor=colors.white),
        'etiqueta': _estilo('etiqueta', fontName=FUENTE_NEGRITA, fontSize=6.5, leading=8, textColor=GRIS_TEXTO),
        'etiqueta_suelta': _estilo('etiqueta_suelta', fontName=FUENTE_NEGRITA, fontSize=8, spaceBefore=2, spaceAfter=2),
        'valor': _estilo('valor', fontSize=9),
        'th': _estilo('th', fontName=FUENTE_NEGRITA, fontSize=7.5, alignment=TA_CENTER),
        'celda': _estilo('celda', fontSize=8),
        'parrafo': _estilo('parrafo', fontSize=9.5, leading=13),
        'firma': _estilo('firma', fontName=FUENTE_NEGRITA, fontSize=8, alignment=TA_CENTER),
        'firma_detalle': _estilo('firma_detalle', fontSize=7.5, alignment=TA_CENTER, textColor=GRIS_TEXTO),
    }


def renderizar_formulario(contexto: dict, datos: dict, config_pdf: dict | None) -> bytes:
    definicion = contexto['definicion']
    pagina = definicion['pagina']
    enc = definicion['encabezado']
    tamano = tamano_de_pagina(pagina)
    con_cabecera = enc['tipo'] != 'ninguno'
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=tamano, leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=(32 if con_cabecera else 15) * mm, bottomMargin=24 * mm,
        title=enc.get('titulo') or 'Documento', author='CONATEL',
    )
    e = _estilos()
    historia = []
    if enc.get('titulo'):
        historia.append(Paragraph(escape(enc['titulo']).upper(), e['titulo']))
    if enc.get('subtitulo'):
        historia.append(Paragraph(escape(enc['subtitulo']), e['subtitulo']))
    historia.append(Spacer(1, 2 * mm))
    for b in definicion['bloques']:
        if b['tipo'] == 'salto_pagina':
            historia.append(PageBreak())
        else:
            historia.extend(_BLOQUES[b['tipo']](b, doc.width, datos, e))

    config_pie = config_pdf if enc['tipo'] == 'institucional' else {'tipo_cintillo': 'GENERICO'}
    logo = contexto.get('logo')

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        if enc['tipo'] == 'institucional':
            for el in create_header('', width=doc_.width, config=config_pdf):
                el.wrap(doc_.width, doc_.topMargin)
                el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - 30 * mm + 8)
        elif enc['tipo'] == 'logo_propio' and logo:
            try:
                canvas.drawImage(ImageReader(BytesIO(reducir_imagen_para_pdf(logo, 500))), doc_.leftMargin,
                                 doc_.pagesize[1] - 28 * mm, width=45 * mm, height=22 * mm,
                                 preserveAspectRatio=True, anchor='sw', mask='auto')
            except Exception:  # noqa: BLE001
                pass
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 0, config=config_pie)

    doc.build(historia, onFirstPage=_en_pagina, onLaterPages=_en_pagina)
    return buffer.getvalue()
