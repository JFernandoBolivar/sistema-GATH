"""Panel inmovilizado de los Excel institucionales (FIX-QA13).

Una hoja con una sola tabla congela su encabezado; una hoja con varias tablas
no (congelar la última ancla la vista y la parte superior parece faltar).
"""
from io import BytesIO

from openpyxl import Workbook, load_workbook

from core.infrastructure.excel.estilo_reporte import escribir_tabla


def _libro(hoja) -> Workbook:
    libro = Workbook()
    libro.remove(libro.active)
    libro.create_sheet(hoja)
    return libro


def _recargar(libro: Workbook):
    buffer = BytesIO()
    libro.save(buffer)
    buffer.seek(0)
    return load_workbook(buffer)


def test_hoja_con_una_tabla_inmoviliza_su_encabezado():
    libro = _libro('Una tabla')
    hoja = libro['Una tabla']
    escribir_tabla(hoja, 5, ['Cédula', 'Nombre'], [['123', 'Ana'], ['456', 'Luis']])

    recargado = _recargar(libro)['Una tabla']
    assert recargado.freeze_panes == 'A6'
    assert recargado.print_title_rows == '$5:$5'


def test_hoja_con_varias_tablas_no_inmoviliza_ninguna_fila():
    libro = _libro('Resumen')
    hoja = libro['Resumen']
    escribir_tabla(hoja, 5, ['Indicador', 'Valor'], [['Total', 10]])
    escribir_tabla(hoja, 9, ['Tipo', 'Total'], [['JUBILADO', 8]])
    escribir_tabla(hoja, 14, ['Tipo', 'Estado', 'Total'], [['JUBILADO', 'VALIDADA', 3]])

    recargado = _recargar(libro)['Resumen']
    assert recargado.freeze_panes is None
    assert recargado.print_title_rows is None
    # Las tres tablas siguen en la hoja.
    assert recargado['A5'].value == 'Indicador'
    assert recargado['A9'].value == 'Tipo'
    assert recargado['A14'].value == 'Tipo'


def test_hoja_con_una_tabla_y_congelar_false_no_inmoviliza():
    libro = _libro('Sin congelar')
    hoja = libro['Sin congelar']
    escribir_tabla(hoja, 3, ['A'], [['x']], congelar=False)

    assert _recargar(libro)['Sin congelar'].freeze_panes is None
