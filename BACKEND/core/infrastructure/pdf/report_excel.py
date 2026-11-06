"""
Motor genérico de reportes Excel (Fase 2.4 del plan de reparación).

Comparte el estilo institucional único de `core.infrastructure.excel.estilo_reporte`
(TLF-K): Arial, azul CONATEL, cebra suave, bordes finos, anchos automáticos y
configuración de impresión horizontal. No hay estilos propios del módulo.
"""
from datetime import datetime
from io import BytesIO

from openpyxl import Workbook

from core.infrastructure.excel.estilo_reporte import (
    ajustar_anchos,
    configurar_impresion,
    escribir_encabezado_institucional,
    escribir_pie,
    escribir_tabla,
)

# Etiquetas con tilde/siglas que la capitalización automática no resuelve.
ETIQUETAS_COLUMNA = {
    'total_anos_apn': 'Total años APN',
}


def _encabezado(columna: str) -> str:
    return ETIQUETAS_COLUMNA.get(columna, columna.replace('_', ' ').capitalize())


def generar_reporte_excel(
    titulo: str, columnas: list[str], filas: list[dict],
    filtros: list[tuple[str, str]] | None = None,
) -> bytes:
    libro = Workbook()
    hoja = libro.active
    hoja.title = (titulo[:31] or 'Reporte').strip()

    generado_en = datetime.now()
    encabezados = [_encabezado(columna) for columna in columnas]
    datos = [[fila.get(columna) for columna in columnas] for fila in filas]

    fila = escribir_encabezado_institucional(
        hoja,
        titulo=titulo,
        subtitulo='Reporte institucional',
        filtros=[*(filtros or []), ('Registros exportados', str(len(datos)))],
        generado_en=generado_en,
        columnas=len(columnas),
    )
    fila = escribir_tabla(hoja, fila, encabezados, datos)
    ajustar_anchos(hoja, encabezados, datos)
    escribir_pie(hoja, fila + 2, len(columnas), f'Generado el {generado_en:%d/%m/%Y %H:%M}')
    configurar_impresion(hoja, len(columnas), fila)

    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
