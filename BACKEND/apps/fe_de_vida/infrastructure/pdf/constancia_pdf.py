"""
Constancia de fe de vida en PDF (C4, PLAN §2.11) con el motor ReportLab del kernel (encabezado y pie
institucionales de `core/infrastructure/pdf`). Lleva número y QR de verificación interna (el código de
verificación va solo dentro del QR), y el nombre y la cédula de quien(es) certifican, como en la planilla física (sin cargo ni vía de
aprobación). Sin firma digitalizada, sin sello y sin la selfie. El título va solo en el cuerpo, no en el encabezado.
"""
from io import BytesIO
from xml.sax.saxutils import escape

import qrcode
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.fe_de_vida.domain.entities.constancia import ConstanciaFeDeVida, PlantillaConstancia
from core.infrastructure.pdf.pdf_components import create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import COLORS, FONTS, PAGE_CONFIG, get_paragraph_styles

LADO_QR_MM = 32
TITULO_CERTIFICAN = 'Funcionario(s) que certifica(n)'
COLUMNAS_CERTIFICAN = ('Nombre y apellido', 'Cédula de identidad')


def _qr(contenido: str) -> Image:
    img = qrcode.QRCode(box_size=4, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
    img.add_data(contenido)
    img.make(fit=True)
    buffer = BytesIO()
    img.make_image().save(buffer, format='PNG')
    buffer.seek(0)
    return Image(buffer, width=LADO_QR_MM * mm, height=LADO_QR_MM * mm)


class GeneradorConstanciaPDF:
    def generar(
        self, *, constancia: ConstanciaFeDeVida, plantilla: PlantillaConstancia, texto: str, proceso_nombre: str,
        emitida_en, via_directa: bool, url_verificacion: str,
    ) -> bytes:
        pagina = PAGE_CONFIG['portrait']
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=pagina['pagesize'], leftMargin=pagina['leftMargin'], rightMargin=pagina['rightMargin'],
            topMargin=pagina['topMargin'], bottomMargin=pagina['bottomMargin'],
            title=f'{plantilla.titulo} {constancia.numero}', author='GATH - CONATEL',
        )
        estilos = get_paragraph_styles()
        cuerpo = ParagraphStyle(
            'ConstanciaCuerpo', fontName=FONTS['body'][0], fontSize=11, leading=17,
            alignment=TA_JUSTIFY, textColor=COLORS['text'],
        )
        centro = estilos['CenterSmall']
        historia = [
            Paragraph(f'<b>{escape(plantilla.titulo)}</b>', estilos['Title']),
            Paragraph(escape(proceso_nombre), centro),
            Spacer(1, 8 * mm),
            Paragraph(escape(texto), cuerpo),
            Spacer(1, 10 * mm),
            Paragraph(f'<b>{TITULO_CERTIFICAN}</b>', centro),
            Spacer(1, 3 * mm),
        ]
        celda = estilos['TableCell']
        filas = [[Paragraph(f'<b>{col}</b>', celda) for col in COLUMNAS_CERTIFICAN]] + [
            [Paragraph(escape(c.nombre), celda), Paragraph(f'C.I. N.° {escape(c.cedula)}', celda)]
            for c in constancia.certificada_por
        ]
        certifican = Table(filas, colWidths=[doc.width * 0.6, doc.width * 0.4])
        certifican.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, COLORS['text']), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        historia.append(certifican)
        datos = Paragraph(
            f'<b>Constancia N.° {escape(constancia.numero)}</b><br/>'
            f'Emitida el {emitida_en.strftime("%d/%m/%Y %H:%M")}<br/>'
            'Escanee el código QR para verificar su autenticidad.',
            estilos['TableCell'],
        )
        pie = Table([[_qr(url_verificacion), datos]], colWidths=[LADO_QR_MM * mm + 4 * mm, None])
        pie.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        historia += [Spacer(1, 8 * mm), pie]

        def _pagina(canvas, doc_):
            canvas.saveState()
            for el in create_header('', width=doc_.width):
                el.wrap(doc_.width, doc_.topMargin)
                el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - pagina['topMargin'] + 10 * mm)
            canvas.restoreState()
            draw_footer(canvas, doc_, doc_.page, 0, f'Constancia {constancia.numero}')

        doc.build(historia, onFirstPage=_pagina, onLaterPages=_pagina)
        return buffer.getvalue()
