"""
Motor genérico de reportes PDF (Fase 2.4 del plan de reparación,
`PLAN_REPARACION_GATH.md`; R-06/R-07 del plan original).

Réplica funcional simplificada de `RAC/services/pdf/base_generator.py`: en
vez de una jerarquía de clases con un generador por tipo de entidad (el
legado tenía uno por cada de los 5 tipos: activo, pasivo, familiar,
asignación, graduados), esta única función renderiza cualquier
`ResultadoReporte` (`apps/reportes/domain/entities/resultado_reporte.py`) —
el mismo objeto ya devuelto por `RepoReportesORM` para JSON. Un reporte
nuevo que se agregue a `apps.reportes` obtiene el PDF gratis con solo
producir un `ResultadoReporte`, sin escribir una plantilla nueva.
"""
from datetime import datetime
from io import BytesIO

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from core.infrastructure.pdf.pdf_components import create_data_table, create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles


def generar_reporte_pdf(titulo: str, columnas: list[str], filas: list[dict], orientation: str = 'landscape') -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG.get(orientation, PAGE_CONFIG['landscape'])
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title=titulo,
        author='GATH - CONATEL',
        subject=f"Reporte generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )
    ancho_disponible = doc.pagesize[0] - page_config['leftMargin'] - page_config['rightMargin']

    styles = get_paragraph_styles()
    story = [
        Paragraph(f"Total de registros: {len(filas)}", styles['TableCell']),
        Spacer(1, 6 * mm),
        create_data_table(columnas, filas, col_widths=None if not columnas else [ancho_disponible / len(columnas)] * len(columnas)),
    ]

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header(titulo, width=doc_.width):
            w, h = el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10 * mm)
        canvas.restoreState()
        # `total_pages` no se conoce hasta terminar el build (reportlab necesita
        # dos pasadas para eso, igual que el legado `base_generator.py`, que
        # tampoco lo resolvía) — se muestra solo el número de página actual.
        draw_footer(canvas, doc_, doc_.page, 0, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}")

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)

    buffer.seek(0)
    return buffer.getvalue()
