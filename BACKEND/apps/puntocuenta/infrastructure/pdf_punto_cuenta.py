"""
Generador del documento PDF de un Punto de Cuenta, reutilizando el motor
genérico de `core/infrastructure/pdf/` (mismo `create_header`/`draw_footer`
que usa `apps.reportes`, ya alimentados por el cintillo configurable de
HU 0009 vía `apps.configuracion.infrastructure.pdf_config.construir_config_pdf()`).

Vive en `infrastructure/` (no `application/`) porque hace I/O de
renderizado -- el caso de uso de creación del registro (`application/
use_cases/generar_punto_cuenta.py`) permanece puro y no lo conoce; solo el
receiver (`infrastructure/receivers.py`) invoca esto, de forma leniente.
"""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from core.infrastructure.pdf.pdf_components import create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles


def _fila(label: str, valor: str, styles) -> Paragraph:
    return Paragraph(f"<b>{escape(label)}:</b> {escape(valor)}", styles['TableCell'])


def construir_pdf_punto_cuenta(dto: PuntoCuentaDTO) -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG['portrait']
    styles = get_paragraph_styles()
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title='Punto de Cuenta',
        author='GATH - CONATEL',
        subject=f"Punto de cuenta generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )

    story = [
        Spacer(1, 4),
        _fila('Empleado', f"{dto.empleado_nombre or 'N/A'} (C.I. {dto.empleado_cedula})", styles),
        _fila('Cargo', str(dto.cargo_id), styles),
        Spacer(1, 8),
        _fila('Dependencia de origen', dto.dependencia_origen_nombre or 'N/A', styles),
        _fila('Dependencia de destino', dto.dependencia_destino_nombre or 'N/A', styles),
        Spacer(1, 8),
        _fila('Motivo', dto.motivo_nombre or 'N/A', styles),
        _fila('Fecha', dto.fecha, styles),
    ]

    config_pdf = construir_config_pdf()

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header('Punto de Cuenta', width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10)
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 1, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config_pdf)

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)
    buffer.seek(0)
    return buffer.getvalue()
