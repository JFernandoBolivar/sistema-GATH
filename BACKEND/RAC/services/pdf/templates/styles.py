"""
Estilos y configuraciones para la generación de PDFs.
Define colores, fuentes, tamaños de página y estilos de tabla reutilizables.
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import TableStyle
from reportlab.lib.units import mm, cm

# =============================================================================
# COLORES INSTITUCIONALES
# =============================================================================
COLORS = {
    'primary': colors.HexColor('#1a237e'),      # Azul institucional oscuro
    'secondary': colors.HexColor('#3949ab'),    # Azul secundario
    'accent': colors.HexColor('#5c6bc0'),       # Azul claro
    'text': colors.HexColor('#000000'),         # Texto principal
    'muted': colors.HexColor('#666666'),        # Texto secundario
    'light': colors.HexColor('#999999'),        # Texto terciario
    'border': colors.HexColor('#e0e0e0'),       # Bordes
    'header_bg': colors.HexColor('#f5f5f5'),    # Fondo de headers
    'row_alt': colors.HexColor('#fafafa'),      # Filas alternadas
    'success': colors.HexColor('#28a745'),      # Verde éxito
    'warning': colors.HexColor('#ffc107'),      # Amarillo advertencia
    'danger': colors.HexColor('#dc3545'),       # Rojo peligro
    'info': colors.HexColor('#17a2b8'),         # Azul información
    'white': colors.white,
    'black': colors.black,
}

# =============================================================================
# CONFIGURACIÓN DE FUENTES
# =============================================================================
FONTS = {
    'title': ('Helvetica-Bold', 14),
    'subtitle': ('Helvetica-Bold', 12),
    'section': ('Helvetica-Bold', 10),
    'body': ('Helvetica', 9),
    'small': ('Helvetica', 8),
    'tiny': ('Helvetica', 7),
    'header_cell': ('Helvetica-Bold', 8),
    'table_cell': ('Helvetica', 7),
}

# =============================================================================
# CONFIGURACIÓN DE PÁGINA
# =============================================================================
PAGE_CONFIG = {
    'portrait': {
        'pagesize': A4,
        'leftMargin': 25 * mm,
        'rightMargin': 25 * mm,
        'topMargin': 35 * mm,
        'bottomMargin': 40 * mm,
    },
    'landscape': {
        'pagesize': landscape(A4),
        'leftMargin': 20 * mm,
        'rightMargin': 20 * mm,
        'topMargin': 30 * mm,
        'bottomMargin': 35 * mm,
    }
}

# =============================================================================
# ESTILOS DE PÁRRAFO
# =============================================================================
def get_paragraph_styles():
    """Retorna un diccionario con estilos de párrafo personalizados."""
    styles = getSampleStyleSheet()
    
    custom_styles = {
        'Title': ParagraphStyle(
            name='CustomTitle',
            fontName=FONTS['title'][0],
            fontSize=FONTS['title'][1],
            textColor=COLORS['black'],
            alignment=TA_CENTER,
            spaceAfter=10,
        ),
        'Subtitle': ParagraphStyle(
            name='CustomSubtitle',
            fontName=FONTS['subtitle'][0],
            fontSize=FONTS['subtitle'][1],
            textColor=COLORS['secondary'],
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        'SectionTitle': ParagraphStyle(
            name='SectionTitle',
            fontName=FONTS['section'][0],
            fontSize=FONTS['section'][1],
            textColor=COLORS['black'],
            alignment=TA_LEFT,
            spaceBefore=12,
            spaceAfter=6,
            borderPadding=3,
        ),
        'Body': ParagraphStyle(
            name='CustomBody',
            fontName=FONTS['body'][0],
            fontSize=FONTS['body'][1],
            textColor=COLORS['text'],
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        'Small': ParagraphStyle(
            name='CustomSmall',
            fontName=FONTS['small'][0],
            fontSize=FONTS['small'][1],
            textColor=COLORS['black'],
            alignment=TA_LEFT,
        ),
        'CenterSmall': ParagraphStyle(
            name='CenterSmall',
            fontName=FONTS['small'][0],
            fontSize=FONTS['small'][1],
            textColor=COLORS['black'],
            alignment=TA_CENTER,
        ),
        'TableHeader': ParagraphStyle(
            name='TableHeader',
            fontName=FONTS['header_cell'][0],
            fontSize=FONTS['header_cell'][1],
            textColor=COLORS['black'],
            alignment=TA_CENTER,
        ),
        'TableCell': ParagraphStyle(
            name='TableCell',
            fontName=FONTS['table_cell'][0],
            fontSize=FONTS['table_cell'][1],
            textColor=COLORS['text'],
            alignment=TA_CENTER,
        ),
    }
    
    return custom_styles


def get_table_style(with_alternating_rows=True):
    """
    Retorna un estilo de tabla reutilizable.
    
    Args:
        with_alternating_rows: Si True, aplica colores alternados a las filas.
    """
    style_commands = [
        # Encabezado
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['white']),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLORS['black']),
        ('FONTNAME', (0, 0), (-1, 0), FONTS['header_cell'][0]),
        ('FONTSIZE', (0, 0), (-1, 0), FONTS['header_cell'][1]),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Cuerpo de la tabla
        ('FONTNAME', (0, 1), (-1, -1), FONTS['table_cell'][0]),
        ('FONTSIZE', (0, 1), (-1, -1), FONTS['table_cell'][1]),
        ('TEXTCOLOR', (0, 1), (-1, -1), COLORS['text']),
        ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        
        # Bordes
        ('GRID', (0, 0), (-1, -1), 0.5, COLORS['border']),
        ('LINEBELOW', (0, 0), (-1, 0), 1, COLORS['black']),
    ]
    
    return TableStyle(style_commands)


def get_header_style():
    """Retorna el estilo para el header del documento."""
    return {
        'logo_width': 60,
        'logo_height': 24,
        'title_font': FONTS['title'],
        'subtitle_font': FONTS['subtitle'],
        'text_color': COLORS['black'],
    }


def get_footer_style():
    """Retorna el estilo para el footer del documento."""
    return {
        'banner_height': 40,
        'text_font': FONTS['tiny'],
        'text_color': COLORS['muted'],
        'page_number_font': FONTS['small'],
    }
