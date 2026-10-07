"""
Generador del PDF de historial de movimientos, migrado desde
`NextJS/src/modules/movimientos/ui/pdf/report-movements-pdf.tsx`
(@react-pdf/renderer, cliente) a backend con ReportLab -- mismo motor y
cintillo configurable que ya usan `apps.reportes`/`apps.puntocuenta`/
`apps.pasivos`/`apps.personal`.

`MovimientoCargoDTO` ya trae todos los nombres resueltos (ver
`apps.movimientos.infrastructure.repositories.repo_movimientos_orm`), así
que este módulo solo formatea.
"""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.movimientos.application.dtos.movimientos_dtos import MovimientoCargoDTO
from core.infrastructure.pdf.pdf_components import create_data_table, create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles


def _val(v) -> str:
    return str(v) if v not in (None, "") else "N/A"


def _fecha(v) -> str:
    if not v:
        return "N/A"
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return str(v)


def construir_pdf_historial_movimientos(
    movimientos: list[MovimientoCargoDTO], cedula: str | None, usuario_nombre: str | None = None,
) -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG['landscape']
    styles = get_paragraph_styles()
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title='Historial de movimientos del trabajador',
        author='GATH - CONATEL',
        subject=f"Reporte generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )

    texto_generacion = (
        f"Usuario: {usuario_nombre}, " if usuario_nombre else ""
    ) + f"Fecha de generación: {generado_en.strftime('%d/%m/%Y %H:%M:%S')}"

    story = [
        Paragraph(escape(texto_generacion), styles['CenterSmall']),
        Spacer(1, 6),
        Paragraph(
            f"<b>{'Cédula' if cedula else 'Criterio'}:</b> "
            f"{escape(cedula) if cedula else 'Historial General de Movimientos'}",
            styles['TableCell'],
        ),
        Spacer(1, 6),
    ]

    if movimientos:
        columnas = ['#', 'Código', 'Fecha', 'Tipo Movimiento', 'Denominación', 'Cargo Específico', 'Grado', 'Estatus', 'Modificado Por']
        col_widths = [10 * mm, 22 * mm, 22 * mm, 30 * mm, 40 * mm, 40 * mm, 20 * mm, 25 * mm, 40 * mm]
        filas = [
            {
                '#': idx + 1,
                'Código': _val(m.codigo_puesto),
                'Fecha': _fecha(m.fecha_movimiento),
                'Tipo Movimiento': _val(m.tipo_movimiento),
                'Denominación': _val(m.denominacion_nombre),
                'Cargo Específico': _val(m.especifica_nombre),
                'Grado': _val(m.grado_nombre),
                'Estatus': _val(m.estatus_nombre),
                'Modificado Por': _val(m.ejecutado_por_nombre),
            }
            for idx, m in enumerate(movimientos)
        ]
        story.append(create_data_table(columnas, filas, col_widths=col_widths))
    else:
        story.append(Paragraph('Sin movimientos registrados', styles['TableCell']))

    config_pdf = construir_config_pdf()

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header('Historial de movimientos del trabajador', width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10)
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 0, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config_pdf)

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)
    buffer.seek(0)
    return buffer.getvalue()
