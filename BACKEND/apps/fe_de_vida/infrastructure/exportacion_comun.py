"""Utilidades compartidas de los Excel de fe de vida (O21, O23 y O25).

Encabezado institucional, tabla con encabezado azul/blanco, bordes finos,
filas alternas, alineación por tipo de dato, filtro automático, panel
congelado y anchos calculados por el contenido más largo (con tope).
"""
import re

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from core.infrastructure.pdf.excel_seguro import forzar_texto

AZUL = '1A237E'
AZUL_MEDIO = '3949AB'
AZUL_CLARO = 'E8F4FD'
GRIS_TEXTO = '555555'
FILA_ALTERNA = 'F4F6FB'
BORDE = Border(
    left=Side(style='thin', color='D0D0D0'),
    right=Side(style='thin', color='D0D0D0'),
    top=Side(style='thin', color='D0D0D0'),
    bottom=Side(style='thin', color='D0D0D0'),
)
_FECHA = re.compile(r'^\d{2}/\d{2}/\d{4}( \d{2}:\d{2})?$')
_TOPE_ANCHO = 45


def _alineacion(valor) -> Alignment:
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        return Alignment(horizontal='right', vertical='top', wrap_text=True)
    if isinstance(valor, str) and _FECHA.match(valor):
        return Alignment(horizontal='center', vertical='top', wrap_text=True)
    return Alignment(horizontal='left', vertical='top', wrap_text=True)


def escribir_encabezado_institucional(
    ws, *, titulo: str, subtitulo: str, filtros: list[tuple[str, str]],
    generado_en, columnas: int,
) -> int:
    """Título, proceso, filtros y fecha en filas superiores combinadas.

    Devuelve la fila libre siguiente para empezar el contenido.
    """
    ultima = get_column_letter(columnas)
    ws.merge_cells(f'A1:{ultima}1')
    ws['A1'] = titulo
    ws['A1'].font = Font(bold=True, size=16, color=AZUL)
    ws['A1'].alignment = Alignment(vertical='center')
    ws.row_dimensions[1].height = 24

    ws.merge_cells(f'A2:{ultima}2')
    ws['A2'] = subtitulo
    ws['A2'].font = Font(bold=True, size=12, color='000000')
    ws.row_dimensions[2].height = 20

    ws.merge_cells(f'A3:{ultima}3')
    ws['A3'] = f"Generado el {generado_en:%d/%m/%Y %H:%M}"
    ws['A3'].font = Font(italic=True, size=10, color=GRIS_TEXTO)

    fila = 5
    ws.merge_cells(f'A{fila}:{ultima}{fila}')
    ws.cell(row=fila, column=1, value='Filtros aplicados').font = Font(bold=True, size=11, color=AZUL_MEDIO)
    fila += 1
    for etiqueta, valor in filtros:
        celda = ws.cell(row=fila, column=1, value=etiqueta)
        celda.font = Font(bold=True, color='000000')
        celda.alignment = Alignment(vertical='top')
        if columnas > 1:
            ws.merge_cells(f'B{fila}:{ultima}{fila}')
        valor_celda = ws.cell(row=fila, column=2, value=valor)
        valor_celda.alignment = Alignment(vertical='top', wrap_text=True)
        fila += 1
    return fila + 1


def escribir_seccion(ws, fila: int, titulo: str, columnas: int) -> int:
    """Título de sección con línea inferior azul; devuelve la fila siguiente."""
    ultima = get_column_letter(columnas)
    ws.merge_cells(f'A{fila}:{ultima}{fila}')
    celda = ws.cell(row=fila, column=1, value=titulo)
    celda.font = Font(bold=True, size=11, color=AZUL_MEDIO)
    celda.alignment = Alignment(vertical='center')
    for columna in range(1, columnas + 1):
        ws.cell(row=fila, column=columna).border = Border(bottom=Side(style='medium', color=AZUL_MEDIO))
    return fila + 1


def escribir_tabla(
    ws, fila: int, columnas: list[str], filas: list[list], *,
    auto_filtro: bool = True, congelar: bool = True,
) -> int:
    for indice, columna in enumerate(columnas, start=1):
        celda = ws.cell(row=fila, column=indice, value=columna)
        celda.font = Font(bold=True, color='FFFFFF', size=10)
        celda.fill = PatternFill('solid', start_color=AZUL)
        celda.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        celda.border = BORDE
    ws.row_dimensions[fila].height = 28
    for desplazamiento, valores in enumerate(filas, start=1):
        alterna = desplazamiento % 2 == 0
        for indice, valor in enumerate(valores, start=1):
            celda = ws.cell(row=fila + desplazamiento, column=indice)
            celda.value = valor
            forzar_texto(celda)
            celda.border = BORDE
            celda.alignment = _alineacion(valor)
            if alterna:
                celda.fill = PatternFill('solid', start_color=FILA_ALTERNA)
    ultima = fila + len(filas)
    if auto_filtro:
        ws.auto_filter.ref = f'A{fila}:{get_column_letter(len(columnas))}{ultima}'
    if congelar:
        ws.freeze_panes = ws.cell(row=fila + 1, column=1)
    return ultima


def ajustar_anchos(ws, columnas: list[str], filas: list[list]) -> None:
    """Ancho por el contenido más largo; solo crece y nunca pasa del tope."""
    for indice, columna in enumerate(columnas, start=1):
        largo = max(
            [len(str(columna))] + [len(str(fila[indice - 1])) for fila in filas] or [10],
        )
        letra = get_column_letter(indice)
        actual = ws.column_dimensions[letra].width or 0
        ws.column_dimensions[letra].width = max(actual, min(max(11, largo + 2), _TOPE_ANCHO))
