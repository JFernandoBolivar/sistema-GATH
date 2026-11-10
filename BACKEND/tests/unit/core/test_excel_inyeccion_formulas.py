"""M-01 / S6-02: un texto que empieza por '=' no se guarda como fórmula en los reportes Excel."""
from io import BytesIO

from openpyxl import load_workbook

from core.infrastructure.pdf.report_excel import generar_reporte_excel


def test_texto_con_igual_queda_como_texto_literal():
    contenido = generar_reporte_excel(
        titulo='Prueba',
        columnas=['nombre', 'n'],
        filas=[{'nombre': '=HYPERLINK("http://x","clic")', 'n': 5}],
        filtros=[('Busqueda', '=1+1')],
    )
    ws = load_workbook(BytesIO(contenido)).active
    valores = {c.value: c.data_type for fila in ws.iter_rows() for c in fila if c.value is not None}
    # S6-02: además de quedar como texto, se antepone el apóstrofo de Excel.
    assert valores["'=HYPERLINK(\"http://x\",\"clic\")"] == 's'
    assert valores["'=1+1"] == 's'
    assert valores[5] == 'n'
