"""
Componentes reutilizables para la generación de PDFs.
Incluye funciones para crear headers, footers, títulos de sección y tablas.
"""
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, Image
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from django.conf import settings
import os

from .styles import (
    COLORS, FONTS, get_paragraph_styles, get_table_style
)

# Diccionario global para cachear las rutas de los logos y evitar accesos excesivos al disco
_LOGO_CACHE = {}

def get_logo_path(logo_name):
    """
    Obtiene la ruta completa de un logo con sistema de caché.
    
    Args:
        logo_name: Nombre del archivo del logo (ej: 'logoOAC.png')
    
    Returns:
        Ruta completa al archivo del logo o None si no existe.
    """
    # Verificar si ya tenemos la ruta en caché
    if logo_name in _LOGO_CACHE:
        return _LOGO_CACHE[logo_name]

    path_found = None

    # 1. Buscar en static
    static_path = os.path.join(settings.BASE_DIR, 'RAC', 'static', 'pdf_assets', logo_name)
    if os.path.exists(static_path):
        path_found = static_path
    
    # 2. Buscar en STATIC_ROOT
    if not path_found and hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
        static_root_path = os.path.join(settings.STATIC_ROOT, 'pdf_assets', logo_name)
        if os.path.exists(static_root_path):
            path_found = static_root_path

    # 3. Buscar en la carpeta templates.img
    if not path_found:
        templates_img_path = os.path.join(settings.BASE_DIR, 'RAC', 'services', 'pdf', 'templates', 'img', logo_name)
        if os.path.exists(templates_img_path):
            path_found = templates_img_path
    
    # Guardar en caché el resultado (incluso si es None para no re-escanear)
    _LOGO_CACHE[logo_name] = path_found
    return path_found

def create_header(title, subtitle=None, width=None):
    """
    Crea el header del documento con logos y título.
    """
    styles = get_paragraph_styles()
    elements = []
    
    if not width:
        width = 160 * mm 

    logo_left_path = get_logo_path('logo01.png')
    logo_right_path = get_logo_path('logo02.png')

    header_data = []
    
    if logo_left_path:
        try:
            logo_left = Image(logo_left_path, width=50*mm, height=25*mm, mask='auto')
            header_data.append(logo_left)
        except Exception:
            header_data.append('')
    else:
        header_data.append('')
    
    title_paragraph = Paragraph(title.upper(), styles['Title'])
    header_data.append(title_paragraph)
    
    if logo_right_path:
        try:
            logo_right = Image(logo_right_path, width=33*mm, height=15*mm, mask='auto')
            header_data.append(logo_right)
        except Exception:
            header_data.append('')
    else:
        header_data.append('')
    
    col_widths = [40*mm, width - 80*mm, 40*mm]
    
    header_table = Table([header_data], colWidths=col_widths)
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), -14),
    ]))
    
    elements.append(header_table)
    
    if subtitle:
        elements.append(Spacer(1, 5))
        subtitle_paragraph = Paragraph(subtitle, styles['Subtitle'])
        elements.append(subtitle_paragraph)
    
    elements.append(Spacer(1, 10))
    
    return elements

def create_footer(doc, canvas, page_number, total_pages, footer_text=None):
    """
    Dibuja el footer en el canvas.
    """
    canvas.saveState()
    
    cintillo_path = get_logo_path('cintillo2.png')
    page_width, page_height = doc.pagesize
    
    if cintillo_path:
        try:
            canvas.drawImage(
                cintillo_path,
                0, 0,
                width=page_width,
                height=60,
                preserveAspectRatio=False,
                mask='auto'
            )
        except Exception:
            pass
    
    if total_pages:
        page_text = f"Página {page_number} de {total_pages}"
    else:
        page_text = f"Página {page_number}"
    
    canvas.setFont(FONTS['small'][0], FONTS['small'][1])
    canvas.setFillColor(COLORS['muted'])
    canvas.drawCentredString(page_width / 2, 42, page_text)
    
    if footer_text:
        canvas.setFont(FONTS['tiny'][0], FONTS['tiny'][1])
        canvas.drawCentredString(page_width / 2, 52, footer_text)
    
    canvas.restoreState()

def create_section_title(text):
    styles = get_paragraph_styles()
    elements = []
    elements.append(Spacer(1, 8))
    
    title_data = [[Paragraph(text.upper(), styles['SectionTitle'])]]
    title_table = Table(title_data, colWidths=['100%'])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['header_bg']),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 1, COLORS['black']),
    ]))
    
    elements.append(title_table)
    elements.append(Spacer(1, 6))
    return elements

def create_info_row(label, value, label_width='35%', value_width='65%'):
    styles = get_paragraph_styles()
    data = [[
        Paragraph(f"<b>{label}:</b>", styles['Body']),
        Paragraph(str(value) if value else 'N/A', styles['Body'])
    ]]
    
    table = Table(data, colWidths=[label_width, value_width])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    return table

def create_data_table(headers, rows, col_widths=None, with_alternating_rows=True):
    styles = get_paragraph_styles()
    header_row = [Paragraph(str(h), styles['TableHeader']) for h in headers]
    
    data_rows = []
    for row in rows:
        data_row = [Paragraph(str(cell) if cell is not None else '', styles['TableCell']) for cell in row]
        data_rows.append(data_row)
    
    table_data = [header_row] + data_rows
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    style = get_table_style(with_alternating_rows)
    
    if with_alternating_rows and len(data_rows) > 0:
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style.add('BACKGROUND', (0, i), (-1, i), COLORS['row_alt'])
    
    table.setStyle(style)
    return table

def create_stats_box(stats, width=None):
    styles = get_paragraph_styles()
    cells = []
    for label, value in stats.items():
        cell_content = f"<b>{label}</b><br/><font size='10'>{value}</font>"
        cells.append(Paragraph(cell_content, styles['CenterSmall']))
    
    if not cells:
        return Spacer(1, 0)
    
    if width:
        col_width = width / len(cells)
        col_widths = [col_width] * len(cells)
    else:
        col_widths = None
    
    table = Table([cells], colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e8f4fd')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 0.5, COLORS['border']),
    ]))
    return table

def format_date(date_value, format_str='%d/%m/%Y'):
    if not date_value:
        return 'N/A'
    try:
        if hasattr(date_value, 'strftime'):
            return date_value.strftime(format_str)
        from datetime import datetime
        if isinstance(date_value, str):
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%Y-%m-%dT%H:%M:%S']:
                try:
                    return datetime.strptime(date_value[:10], fmt[:len(date_value[:10])]).strftime(format_str)
                except Exception:
                    continue
        return str(date_value)
    except Exception:
        return 'N/A'