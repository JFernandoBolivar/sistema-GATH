"""Utilidades compartidas de los PDF de fe de vida (O21 y O23).

Misma línea gráfica de los PDF del sistema: Arial, cintillo configurable, sin
membrete institucional, encabezado en cada página, pie con numeración «X de Y»
y fecha de generación.
"""
from datetime import datetime
from io import BytesIO

from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import SimpleDocTemplate

from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud
from core.infrastructure.pdf.pdf_components import create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG

ETIQUETAS_ESTADO = {
    EstadoSolicitud.BORRADOR.value: 'Borrador',
    EstadoSolicitud.PENDIENTE_REVISION.value: 'En revisión',
    EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK.value: 'Segunda revisión',
    EstadoSolicitud.VALIDADA.value: 'Validada',
    EstadoSolicitud.RECHAZADA.value: 'Rechazada',
    EstadoSolicitud.DEVUELTA.value: 'Devuelta',
    EstadoSolicitud.EXPIRADA.value: 'Vencida',
    EstadoSolicitud.ARCHIVADA.value: 'Archivada',
}
ETIQUETAS_CANAL = {'EN_LINEA': 'En línea', 'PRESENCIAL': 'Presencial'}


class _DocumentoParaPie:
    """`draw_footer` solo necesita `pagesize`; el canvas no expone la plantilla en la 2.ª pasada."""

    def __init__(self, pagesize):
        self.pagesize = pagesize


def _canvas_con_total(config: dict, generado_en: datetime, orientation: str):
    texto_generado = f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}"
    documento_pie = _DocumentoParaPie(PAGE_CONFIG[orientation]['pagesize'])

    class CanvasNumerado(pdf_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            pdf_canvas.Canvas.__init__(self, *args, **kwargs)
            self._estados_paginas = []

        def showPage(self):
            self._estados_paginas.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._estados_paginas)
            for estado in self._estados_paginas:
                self.__dict__.update(estado)
                draw_footer(
                    self, documento_pie, self._pageNumber, total, texto_generado, config=config,
                )
                pdf_canvas.Canvas.showPage(self)
            pdf_canvas.Canvas.save(self)

    return CanvasNumerado


def construir_pdf(
    titulo: str, story: list, *, config: dict | None, generado_en: datetime, orientation: str = 'landscape',
) -> bytes:
    page_config = PAGE_CONFIG[orientation]
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'], rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'], bottomMargin=page_config['bottomMargin'],
        title=titulo, author='GATH - CONATEL',
        subject=f'{titulo} generado el {generado_en:%d/%m/%Y %H:%M}',
    )

    def _encabezado(canvas, doc_):
        canvas.saveState()
        for elemento in create_header(titulo, width=doc_.width, config=config):
            elemento.wrap(doc_.width, doc_.topMargin)
            elemento.drawOn(
                canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10 * mm,
            )
        canvas.restoreState()

    doc.build(
        story, onFirstPage=_encabezado, onLaterPages=_encabezado,
        canvasmaker=_canvas_con_total(config or {}, generado_en, orientation),
    )
    buffer.seek(0)
    return buffer.getvalue()
