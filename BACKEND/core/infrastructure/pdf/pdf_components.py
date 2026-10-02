"""
Componentes reutilizables del motor de reportes PDF (Fase 2.4 del plan de
reparación). Réplica funcional de `RAC/services/pdf/templates/components.py`,
simplificada a lo que usa `report_pdf.py` (encabezado con logos
institucionales, cintillo de pie de página, tabla de datos).
"""
import os
from xml.sax.saxutils import escape

from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle

from core.infrastructure.pdf.pdf_styles import COLORS, FONTS, get_paragraph_styles, get_table_style

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')


def _ruta_asset(nombre: str) -> str | None:
    ruta = os.path.join(_ASSETS_DIR, nombre)
    return ruta if os.path.exists(ruta) else None


HEADER_LABELS = {
    '#': '#',
    'num': '#',
    'codigo': 'Código',
    'cedula': 'Cédula',
    'cedula_empleado': 'Cédula Emp.',
    'cedula_familiar': 'Cédula Fam.',
    'nombres': 'Nombres',
    'apellidos': 'Apellidos',
    'nombre_empleado': 'Nombre Empleado',
    'nombre_familiar': 'Nombre Familiar',
    'nombre_completo': 'Nombre Completo',
    'fecha_ingreso': 'F. Ingreso',
    'fecha_egreso': 'F. Egreso',
    'fecha_nacimiento': 'F. Nacimiento',
    'sexo': 'Sexo',
    'parentesco': 'Parentesco',
    'tipo_nomina': 'Tipo de Nómina',
    'cargo': 'Cargo',
    'cargo_especifico': 'Cargo Esp.',
    'grado': 'Grado',
    'organismo_adscrito': 'Organismo Adscrito',
    'estatus': 'Estatus',
    'motivo_egreso': 'Motivo',
    'ultimo_cargo': 'Último Cargo',
    'dependencia': 'Dependencia',
    'direccion_general': 'Dirección General',
}


def create_header(titulo: str, width) -> list:
    styles = get_paragraph_styles()
    elementos = []

    logo_izq = _ruta_asset('logo01.png')
    logo_der = _ruta_asset('logo02.png')

    fila = []
    fila.append(Image(logo_izq, width=45 * mm, height=22 * mm, mask='auto') if logo_izq else '')

    institucion = "Comisión Nacional de Telecomunicaciones"
    institucion2 = "(CONATEL)"
    header_text = (
        f"<font size='9'><b>{institucion} <br/> {institucion2}</b></font><br/>"
        f"<font size='11'><b><br/>{titulo.upper()}</b></font>"
    )
    fila.append(Paragraph(header_text, styles['Title']))
    fila.append(Image(logo_der, width=30 * mm, height=14 * mm, mask='auto') if logo_der else '')

    col_widths = [45 * mm, width - 85 * mm, 40 * mm]
    tabla = Table([fila], colWidths=col_widths)
    tabla.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elementos.append(tabla)
    elementos.append(Spacer(1, 4 * mm))
    return elementos


def create_stats_box(stats: dict, width=None) -> Table | Spacer:
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
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['stats_bg']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BOX', (0, 0), (-1, -1), 0.5, COLORS['border']),
    ]))
    return table


def draw_footer(canvas, doc, page_number: int, total_pages: int, texto: str | None = None) -> None:
    canvas.saveState()
    cintillo = _ruta_asset('cintillo2.png')
    page_width, _page_height = doc.pagesize

    if cintillo:
        try:
            canvas.drawImage(cintillo, 0, 0, width=page_width, height=15 * mm, preserveAspectRatio=False, mask='auto')
        except Exception:
            pass

    texto_pagina = f"Página {page_number} de {total_pages}" if total_pages else f"Página {page_number}"
    canvas.setFont(*FONTS['small'])
    canvas.setFillColor(COLORS['muted'])
    canvas.drawCentredString(page_width / 2, 16 * mm, texto_pagina)

    if texto:
        canvas.setFont(*FONTS['tiny'])
        canvas.drawCentredString(page_width / 2, 20 * mm, texto)
    canvas.restoreState()


def create_data_table(columnas: list[str], filas: list[dict], col_widths=None) -> Table:
    styles = get_paragraph_styles()
    fila_encabezado = [
        Paragraph(escape(str(HEADER_LABELS.get(c, str(c).replace('_', ' ').upper()))), styles['TableHeader'])
        for c in columnas
    ]

    filas_datos = []
    for fila in filas:
        filas_datos.append([
            Paragraph(escape(str(fila.get(col, '') if fila.get(col) is not None else '')), styles['TableCell'])
            for col in columnas
        ])

    datos_tabla = [fila_encabezado] + filas_datos
    tabla = Table(datos_tabla, colWidths=col_widths, repeatRows=1)
    estilo = get_table_style()
    for i in range(1, len(datos_tabla)):
        if i % 2 == 0:
            estilo.add('BACKGROUND', (0, i), (-1, i), COLORS['row_alt'])
    tabla.setStyle(estilo)
    return tabla
