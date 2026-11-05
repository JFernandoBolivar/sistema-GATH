"""Utilidades compartidas de los Excel de fe de vida (O21 y O23).

Encabezados con relleno institucional, bordes, filtro automático, panel
congelado y ancho de columnas ajustado al contenido.
"""
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from core.infrastructure.pdf.excel_seguro import forzar_texto

AZUL = '1A237E'
AZUL_CLARO = 'E8F4FD'
BORDE = Border(
    left=Side(style='thin', color='D0D0D0'),
    right=Side(style='thin', color='D0D0D0'),
    top=Side(style='thin', color='D0D0D0'),
    bottom=Side(style='thin', color='D0D0D0'),
)


def escribir_tabla(ws, fila: int, columnas: list[str], filas: list[list], *, auto_filtro: bool = True) -> int:
    for indice, columna in enumerate(columnas, start=1):
        celda = ws.cell(row=fila, column=indice, value=columna)
        celda.font = Font(bold=True, color='FFFFFF', size=10)
        celda.fill = PatternFill('solid', start_color=AZUL)
        celda.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        celda.border = BORDE
    for desplazamiento, valores in enumerate(filas, start=1):
        for indice, valor in enumerate(valores, start=1):
            celda = ws.cell(row=fila + desplazamiento, column=indice)
            celda.value = valor
            forzar_texto(celda)
            celda.border = BORDE
            celda.alignment = Alignment(vertical='top', wrap_text=True)
    ultima = fila + len(filas)
    if auto_filtro:
        ws.auto_filter.ref = f'A{fila}:{get_column_letter(len(columnas))}{ultima}'
    ws.freeze_panes = ws.cell(row=fila + 1, column=1)
    return ultima


def ajustar_anchos(ws, columnas: list[str], filas: list[list]) -> None:
    for indice, columna in enumerate(columnas, start=1):
        largo = max([len(str(columna))] + [len(str(fila[indice - 1])) for fila in filas] or [10])
        ws.column_dimensions[get_column_letter(indice)].width = min(max(12, largo + 3), 48)
