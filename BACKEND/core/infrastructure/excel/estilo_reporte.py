"""
Estilo único de los Excel institucionales (TLF-K).

Un solo lugar para tipografía, colores CONATEL, encabezados, tablas, cebra,
bordes, anchos e impresión. Lo reutilizan las exportaciones de fe de vida y el
motor genérico de reportes (`core.infrastructure.pdf.report_excel`), sin
copias de estilos por módulo.

Los colores salen de `core.infrastructure.pdf.paleta` (espejo de la paleta de
la app): azul CONATEL real `#0B4A9E`, acento ámbar y grises. Cero rojo.
"""
import re

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from core.infrastructure.pdf.excel_seguro import forzar_texto, neutralizar_valor
from core.infrastructure.pdf.paleta import (
    HEX_AMARILLO_SUAVE,
    HEX_AZUL_CLARO,
    HEX_AZUL_CONATEL,
    HEX_AZUL_INTERMEDIO,
    HEX_BLANCO,
    HEX_GRIS_BORDE,
    HEX_GRIS_FONDO,
    HEX_GRIS_MUTED,
    HEX_GRIS_TEXTO,
)

# Tipografía única (sans) para todo el libro.
FUENTE = 'Arial'
TAMANO_TITULO = 16
TAMANO_SUBTITULO = 12
TAMANO_TEXTO = 10
TAMANO_SECCION = 11

def _hex(valor: str) -> str:
    return valor.lstrip('#').upper()


AZUL = _hex(HEX_AZUL_CONATEL)
AZUL_MEDIO = _hex(HEX_AZUL_INTERMEDIO)
AZUL_CLARO = _hex(HEX_AZUL_CLARO)
AMARILLO_SUAVE = _hex(HEX_AMARILLO_SUAVE)
GRIS_TEXTO = _hex(HEX_GRIS_TEXTO)
GRIS_MUTED = _hex(HEX_GRIS_MUTED)
FILA_ALTERNA = _hex(HEX_GRIS_FONDO)
BORDE_COLOR = _hex(HEX_GRIS_BORDE)

BORDE = Border(
    left=Side(style='thin', color=BORDE_COLOR),
    right=Side(style='thin', color=BORDE_COLOR),
    top=Side(style='thin', color=BORDE_COLOR),
    bottom=Side(style='thin', color=BORDE_COLOR),
)
_FECHA = re.compile(r'^\d{2}/\d{2}/\d{4}( \d{2}:\d{2})?$')
_PORCENTAJE = re.compile(r'^-?\d+(?:[.,]\d+)?%$')
_TOPE_ANCHO = 45


def _fuente(**kwargs) -> Font:
    return Font(name=FUENTE, **kwargs)


def _alineacion(valor) -> Alignment:
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        return Alignment(horizontal='right', vertical='top', wrap_text=True)
    if isinstance(valor, str) and _FECHA.match(valor):
        return Alignment(horizontal='center', vertical='top', wrap_text=True)
    if isinstance(valor, str) and _PORCENTAJE.match(valor):
        return Alignment(horizontal='right', vertical='top', wrap_text=True)
    return Alignment(horizontal='left', vertical='top', wrap_text=True)


def escribir_encabezado_institucional(
    ws, *, titulo: str, subtitulo: str, filtros: list[tuple[str, str]],
    generado_en, columnas: int,
) -> int:
    """Título, subtítulo, fecha y bloque de filtros compacto. Devuelve la fila libre."""
    ultima = get_column_letter(columnas)
    ws.merge_cells(f'A1:{ultima}1')
    ws['A1'] = titulo
    ws['A1'].font = _fuente(bold=True, size=TAMANO_TITULO, color=AZUL)
    ws['A1'].alignment = Alignment(vertical='center')
    ws.row_dimensions[1].height = 28

    ws.merge_cells(f'A2:{ultima}2')
    ws['A2'] = subtitulo
    ws['A2'].font = _fuente(bold=True, size=TAMANO_SUBTITULO, color=GRIS_TEXTO)
    ws.row_dimensions[2].height = 20

    ws.merge_cells(f'A3:{ultima}3')
    ws['A3'] = f'Generado el {generado_en:%d/%m/%Y %H:%M}'
    ws['A3'].font = _fuente(italic=True, size=9, color=GRIS_MUTED)

    fila = 5
    ws.merge_cells(f'A{fila}:{ultima}{fila}')
    ws.cell(row=fila, column=1, value='Filtros aplicados').font = _fuente(
        bold=True, size=TAMANO_SECCION, color=AZUL,
    )
    fila += 1
    ancho_etiquetas = max((len(str(etiqueta)) for etiqueta, _ in filtros), default=0) + 2
    if ancho_etiquetas > (ws.column_dimensions['A'].width or 0):
        ws.column_dimensions['A'].width = ancho_etiquetas
    for etiqueta, valor in filtros:
        celda = ws.cell(row=fila, column=1, value=etiqueta)
        celda.font = _fuente(bold=True, color=GRIS_TEXTO, size=TAMANO_TEXTO)
        celda.alignment = Alignment(vertical='top', wrap_text=True)
        if columnas > 1:
            ws.merge_cells(f'B{fila}:{ultima}{fila}')
        valor_celda = ws.cell(row=fila, column=2, value=neutralizar_valor(str(valor)))
        forzar_texto(valor_celda)
        valor_celda.font = _fuente(size=TAMANO_TEXTO, color=GRIS_TEXTO)
        valor_celda.alignment = Alignment(vertical='top', wrap_text=True)
        fila += 1
    return fila + 1


def escribir_seccion(ws, fila: int, titulo: str, columnas: int) -> int:
    """Título de sección con línea inferior azul; devuelve la fila siguiente."""
    ultima = get_column_letter(columnas)
    ws.merge_cells(f'A{fila}:{ultima}{fila}')
    celda = ws.cell(row=fila, column=1, value=titulo)
    celda.font = _fuente(bold=True, size=TAMANO_SECCION, color=AZUL)
    celda.alignment = Alignment(vertical='center')
    for columna in range(1, columnas + 1):
        ws.cell(row=fila, column=columna).border = Border(
            bottom=Side(style='medium', color=AZUL),
        )
    return fila + 1


def escribir_tabla(
    ws, fila: int, columnas: list[str], filas: list[list], *,
    auto_filtro: bool = True, congelar: bool = True,
) -> int:
    for indice, columna in enumerate(columnas, start=1):
        # Las cabeceras también pueden venir de datos del usuario.
        celda = ws.cell(row=fila, column=indice, value=neutralizar_valor(columna))
        celda.font = _fuente(bold=True, color=_hex(HEX_BLANCO), size=TAMANO_TEXTO)
        celda.fill = PatternFill('solid', start_color=AZUL)
        celda.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        celda.border = BORDE
    ws.row_dimensions[fila].height = 30
    for desplazamiento, valores in enumerate(filas, start=1):
        alterna = desplazamiento % 2 == 0
        for indice, valor in enumerate(valores, start=1):
            celda = ws.cell(row=fila + desplazamiento, column=indice)
            celda.value = neutralizar_valor(valor)
            forzar_texto(celda)
            celda.font = _fuente(size=TAMANO_TEXTO, color=GRIS_TEXTO)
            celda.border = BORDE
            celda.alignment = _alineacion(valor)
            if isinstance(valor, (int, float)) and not isinstance(valor, bool):
                celda.number_format = '#,##0'
            if alterna:
                celda.fill = PatternFill('solid', start_color=FILA_ALTERNA)
    ultima = fila + len(filas)
    if auto_filtro and filas:
        ws.auto_filter.ref = f'A{fila}:{get_column_letter(len(columnas))}{ultima}'
    tablas = _registrar_tabla(ws)
    if tablas > 1:
        # Una hoja con varias tablas no puede inmovilizar un único encabezado:
        # al abrir el archivo la vista queda anclada en la última tabla y la
        # parte superior (el resumen) parece no estar.
        ws.freeze_panes = None
        # `print_title_rows = None` no limpia el valor en openpyxl: el setter
        # ignora los None. El atributo interno sí.
        ws._print_rows = None
    elif congelar:
        ws.freeze_panes = ws.cell(row=fila + 1, column=1)
        ws.print_title_rows = f'{fila}:{fila}'
    return ultima


def _registrar_tabla(ws) -> int:
    """Cuenta las tablas escritas en la hoja (para decidir el panel inmovilizado)."""
    total = getattr(ws, '_gath_tablas', 0) + 1
    ws._gath_tablas = total
    return total


def ajustar_anchos(ws, columnas: list[str], filas: list[list]) -> None:
    """Ancho por el contenido más largo; solo crece, con tope y sin truncar etiquetas."""
    for indice, columna in enumerate(columnas, start=1):
        largo = max(
            [len(str(columna))] + [len(str(fila[indice - 1])) for fila in filas] or [10],
        )
        letra = get_column_letter(indice)
        actual = ws.column_dimensions[letra].width or 0
        ws.column_dimensions[letra].width = max(actual, min(max(11, largo + 2), _TOPE_ANCHO))


def configurar_impresion(ws, columnas: int, filas: int) -> None:
    """Horizontal, ajustado al ancho, con márgenes finos y encabezado repetido."""
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    if columnas:
        ws.print_area = f'A1:{get_column_letter(columnas)}{max(filas, 1)}'


def escribir_pie(ws, fila: int, columnas: int, texto: str) -> None:
    """Pie discreto con la fecha de generación."""
    ultima = get_column_letter(columnas)
    ws.merge_cells(f'A{fila}:{ultima}{fila}')
    celda = ws.cell(row=fila, column=1, value=texto)
    celda.font = _fuente(italic=True, size=9, color=GRIS_MUTED)
    celda.alignment = Alignment(horizontal='right', vertical='center')
