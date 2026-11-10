"""
Estilos y configuración de página para el motor de reportes PDF (Fase 2.4
del plan de reparación, `PLAN_REPARACION_GATH.md`; R-06/R-07 del plan
original: consolidación de los dos motores duplicados de `RAC/services/pdf/`
y `CARNETIZACION/services/`).

Réplica funcional de `RAC/services/pdf/templates/styles.py`.
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import TableStyle

from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.paleta import AZUL_CLARO, AZUL_CONATEL, AZUL_INTERMEDIO

COLORS = {
    'primary': AZUL_CONATEL,
    'secondary': AZUL_INTERMEDIO,
    'text': colors.HexColor('#000000'),
    'muted': colors.HexColor('#666666'),
    'border': colors.HexColor('#e0e0e0'),
    'header_bg': colors.HexColor('#f5f5f5'),
    'row_alt': colors.HexColor('#fafafa'),
    'stats_bg': AZUL_CLARO,
    'white': colors.white,
    'black': colors.black,
}

FONTS = {
    'title': (FUENTE_NEGRITA, 14),
    'subtitle': (FUENTE_NEGRITA, 12),
    'body': (FUENTE, 9),
    'small': (FUENTE, 8),
    'tiny': (FUENTE, 7),
    'header_cell': (FUENTE_NEGRITA, 8),
    'table_cell': (FUENTE, 7),
}

PAGE_CONFIG = {
    'portrait': {
        'pagesize': A4,
        'leftMargin': 20 * mm,
        'rightMargin': 20 * mm,
        'topMargin': 35 * mm,
        'bottomMargin': 25 * mm,
    },
    'landscape': {
        'pagesize': landscape(A4),
        'leftMargin': 15 * mm,
        'rightMargin': 15 * mm,
        'topMargin': 30 * mm,
        'bottomMargin': 22 * mm,
    },
}


def get_paragraph_styles() -> dict:
    getSampleStyleSheet()  # registra los estilos base una sola vez por proceso
    return {
        'Title': ParagraphStyle(
            name='ReporteTitle', fontName=FONTS['title'][0], fontSize=FONTS['title'][1],
            textColor=COLORS['black'], alignment=TA_CENTER, spaceAfter=10,
        ),
        'TableHeader': ParagraphStyle(
            name='ReporteTableHeader', fontName=FONTS['header_cell'][0], fontSize=FONTS['header_cell'][1],
            textColor=COLORS['black'], alignment=TA_CENTER,
        ),
        'TableCell': ParagraphStyle(
            name='ReporteTableCell', fontName=FONTS['table_cell'][0], fontSize=FONTS['table_cell'][1],
            textColor=COLORS['text'], alignment=TA_LEFT,
        ),
        'CenterSmall': ParagraphStyle(
            name='ReporteCenterSmall', fontName=FONTS['small'][0], fontSize=FONTS['small'][1],
            textColor=COLORS['black'], alignment=TA_CENTER,
        ),
    }


def get_table_style() -> TableStyle:
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['header_bg']),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLORS['black']),
        ('FONTNAME', (0, 0), (-1, 0), FONTS['header_cell'][0]),
        ('FONTSIZE', (0, 0), (-1, 0), FONTS['header_cell'][1]),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('FONTNAME', (0, 1), (-1, -1), FONTS['table_cell'][0]),
        ('FONTSIZE', (0, 1), (-1, -1), FONTS['table_cell'][1]),
        ('TEXTCOLOR', (0, 1), (-1, -1), COLORS['text']),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
        ('TOPPADDING', (0, 1), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, COLORS['border']),
        ('LINEBELOW', (0, 0), (-1, 0), 1, COLORS['black']),
    ])
