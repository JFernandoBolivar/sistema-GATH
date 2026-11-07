"""
Componentes reutilizables del motor de reportes PDF (Fase 2.4 del plan de
reparación). Réplica funcional de `RAC/services/pdf/templates/components.py`,
simplificada a lo que usa `report_pdf.py` (encabezado con logos
institucionales, cintillo de pie de página, tabla de datos).

HU 0009 (Cintillo Editable): `create_header()`/`draw_footer()` aceptan un
`config` opcional (dict plano con primitivas, nunca un modelo/entidad de
`apps.configuracion` — `core/` no importa de `apps/`, regla B16) con los
bytes ya descargados de SeaweedFS. `config=None` preserva el comportamiento
exacto de antes de esta HU (compatibilidad total con cualquier llamador que
no se haya actualizado). `config['tipo_cintillo'] == 'GENERICO'` renderiza
la vista neutral de solo lectura (RN-009-01): sin logos institucionales y
con un título genérico, en vez de inventar un segundo set de imágenes.
"""
import logging
import os
from functools import lru_cache
from io import BytesIO

from PIL import Image as PILImage
from reportlab import rl_config

# Las imágenes van en binario dentro del PDF, no en ASCII85 (que las agranda un 25 %).
rl_config.useA85 = 0
from xml.sax.saxutils import escape

from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle

from core.infrastructure.pdf.pdf_styles import COLORS, FONTS, get_paragraph_styles, get_table_style

logger = logging.getLogger('gath.pdf')

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')

NOMBRE_EMPRESA_DEFECTO = "Comisión Nacional de Telecomunicaciones"
NOMBRE_EMPRESA_DEFECTO_LINEA2 = "(CONATEL)"
TITULO_GENERICO = "Sistema de Gestión"


def _ruta_asset(nombre: str) -> str | None:
    ruta = os.path.join(_ASSETS_DIR, nombre)
    return ruta if os.path.exists(ruta) else None


@lru_cache(maxsize=32)
def reducir_imagen_para_pdf(datos: bytes, max_px: int) -> bytes:
    """
    Reduce la imagen para que su lado mayor no pase de `max_px` (≈300 ppp al
    tamaño en que se dibuja): un logo o cintillo subido a resolución de
    fotografía hacía pesar cada PDF varios MB. Conserva la transparencia (PNG)
    y usa JPEG si no la hay. Si no se puede leer, devuelve los bytes intactos.
    Cacheada: el mismo logo se reduce una sola vez por proceso.
    """
    try:
        with PILImage.open(BytesIO(datos)) as img:
            img.load()
            tiene_alfa = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
            if max(img.size) <= max_px and len(datos) <= 400_000:
                return datos
            img.thumbnail((max_px, max_px), PILImage.LANCZOS)
            salida = BytesIO()
            if tiene_alfa:
                img.convert('RGBA').save(salida, 'PNG', optimize=True)
            else:
                img.convert('RGB').save(salida, 'JPEG', quality=85, optimize=True)
            reducida = salida.getvalue()
            return reducida if len(reducida) < len(datos) else datos
    except Exception:
        logger.warning("No se pudo reducir una imagen del PDF; se usa la original.", exc_info=True)
        return datos


def _imagen_o_asset(config_bytes: bytes | None, nombre_asset: str, max_px: int = 400):
    """
    Devuelve una fuente de imagen válida para `reportlab.platypus.Image`
    (un file-like `BytesIO`, NO un `ImageReader` ya instanciado): los bytes
    de `config` si vienen, si no el asset hardcodeado de respaldo, si no
    `None`, siempre reducidos a `max_px`. `draw_footer()` (que usa
    `canvas.drawImage`, con otra API) envuelve el resultado en `ImageReader`
    él mismo cuando hace falta.
    """
    if not config_bytes:
        ruta = _ruta_asset(nombre_asset)
        if not ruta:
            return None
        with open(ruta, 'rb') as f:
            config_bytes = f.read()
    return BytesIO(reducir_imagen_para_pdf(config_bytes, max_px))


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
    'tipo_pasivo': 'Tipo de Pasivo',
    'contacto': 'Contacto',
    'cargo': 'Cargo',
    'cargo_especifico': 'Cargo Esp.',
    'grado': 'Grado',
    'organismo_adscrito': 'Organismo Adscrito',
    'estatus': 'Estatus',
    'motivo_egreso': 'Motivo',
    'ultimo_cargo': 'Último Cargo',
    'dependencia': 'Dependencia',
    'direccion_general': 'Dirección General',
    'total_anos_apn': 'Total años APN',
}


def create_header(titulo: str, width, config: dict | None = None, mostrar_institucion: bool = False) -> list:
    """Encabezado con logos y el título del documento. Por pedido del usuario
    (2026-11-04) ningún PDF muestra el membrete «Comisión Nacional de
    Telecomunicaciones (CONATEL)»: `mostrar_institucion=True` lo recupera."""
    styles = get_paragraph_styles()
    elementos = []

    es_generico = bool(config) and config.get('tipo_cintillo') == 'GENERICO'

    if es_generico:
        logo_izq = logo_der = None
        header_text = f"<font size='11'><b>{TITULO_GENERICO}</b></font><br/><font size='11'><b><br/>{titulo.upper()}</b></font>"
    else:
        logo_izq = _imagen_o_asset(config.get('logo_principal_bytes') if config else None, 'logo01.png')
        logo_der = _imagen_o_asset(config.get('logo_secundario_bytes') if config else None, 'logo02.png')
        nombre_empresa_config = (config or {}).get('nombre_empresa')
        # El nombre configurado (texto libre de un admin) se escapa antes de
        # insertarlo en el markup de reportlab; el valor por defecto conserva
        # el salto de línea del formato legado (institución / "(CONATEL)").
        linea_empresa = (
            escape(nombre_empresa_config) if nombre_empresa_config
            else f"{NOMBRE_EMPRESA_DEFECTO} <br/> {NOMBRE_EMPRESA_DEFECTO_LINEA2}"
        )
        header_text = (
            f"<font size='9'><b>{linea_empresa}</b></font><br/><font size='11'><b><br/>{titulo.upper()}</b></font>"
            if mostrar_institucion
            else f"<font size='11'><b>{titulo.upper()}</b></font>"
        )

    fila = []
    fila.append(Image(logo_izq, width=45 * mm, height=22 * mm, mask='auto') if logo_izq else '')
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


def draw_footer(canvas, doc, page_number: int, total_pages: int, texto: str | None = None, config: dict | None = None, texto_pagina: str | None = None) -> None:
    canvas.saveState()
    es_generico = bool(config) and config.get('tipo_cintillo') == 'GENERICO'
    cintillo = None if es_generico else _imagen_o_asset(config.get('cintillo_pie_bytes') if config else None, 'cintillo2.png', max_px=1200)
    page_width, _page_height = doc.pagesize

    if cintillo:
        try:
            # `canvas.drawImage` (a diferencia de `platypus.Image`) sí
            # requiere `ImageReader` explícito para un file-like.
            cintillo_dibujable = ImageReader(cintillo) if isinstance(cintillo, BytesIO) else cintillo
            canvas.drawImage(cintillo_dibujable, 0, 0, width=page_width, height=15 * mm, preserveAspectRatio=False, mask='auto')
        except Exception:
            logger.warning("No se pudo dibujar el cintillo del pie de página del PDF.", exc_info=True)

    if texto_pagina is None:
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
