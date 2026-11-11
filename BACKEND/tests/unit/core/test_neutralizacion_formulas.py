"""S6-02: neutralización de fórmulas en celdas de texto de los Excel exportados.

Puro: la regla es una función de cadena, sin Django ni base de datos.
"""
import pytest

from core.infrastructure.pdf.excel_seguro import (
    es_numero,
    neutralizar_fila_valores,
    neutralizar_valor,
)


@pytest.mark.parametrize('texto', [
    '=HYPERLINK("http://malo","clic")',
    '=1+1',
    '+SUM(A1:A9)',
    '@SUM(1+1)',
    '-2+3',
    '-1,5',
    '-',
])
def test_prefija_texto_peligroso(texto):
    resultado = neutralizar_valor(texto)
    if texto == '-':
        assert resultado == '-'
    else:
        assert resultado == "'" + texto


@pytest.mark.parametrize('texto', [
    '=HYPERLINK("http://malo","clic")',
    '=1+1',
    '+SUM(A1:A9)',
    '@SUM(1+1)',
    '-2+3',
    '-1,5',
])
def test_el_valor_original_queda_como_texto_literal(texto):
    """El prefijo impide que Excel evalúe; el texto original se conserva detrás."""
    assert neutralizar_valor(texto)[1:] == texto


@pytest.mark.parametrize('numero', [
    '-15', '+15', '-1.5', '+0.25', '-1e6', '2.5E-3', '-0',
])
def test_numeros_reales_no_se_tocan(numero):
    assert neutralizar_valor(numero) == numero


@pytest.mark.parametrize('valor', [
    '-Infinity', 'Infinity', '-NaN', 'NaN', '-nan', '-sNaN',
])
def test_infinitos_y_nan_no_cuentan_como_numero(valor):
    """`Decimal('-Infinity')` parsea, pero no es un número: se neutraliza."""
    assert es_numero(valor) is False


@pytest.mark.parametrize('valor', ['-Infinity', '-NaN', '-nan', '-sNaN'])
def test_infinitos_y_nan_con_signo_se_neutralizan(valor):
    assert neutralizar_valor(valor) == "'" + valor


@pytest.mark.parametrize('valor', [
    '-', '', None, 0, 5, -5, 1.5, True, False, [], {},
])
def test_valores_que_no_son_texto_peligroso_no_se_tocan(valor):
    assert neutralizar_valor(valor) == valor


def test_marcador_con_espacios_no_es_el_marcador_exacto():
    """Solo el `-` exacto se respeta; `- ` es texto y se neutraliza."""
    assert neutralizar_valor('- ') == "'- "


@pytest.mark.parametrize('texto', [
    'Juan Pérez', 'V-12345678', 'ACTIVO', '  =1+1', 'a=b', 'a@b.com', '123',
])
def test_texto_normal_no_se_toca(texto):
    assert neutralizar_valor(texto) == texto


def test_fila_completa_se_neutraliza_celda_a_celda():
    fila = ['V-1', '=1+1', 5, None, '-', '-10', 'Ana']
    assert neutralizar_fila_valores(fila) == ['V-1', "'=1+1", 5, None, '-', '-10', 'Ana']


def test_reporte_excel_guarda_el_texto_peligroso_como_texto():
    """Integración con el motor de reportes: la celda es texto, no fórmula."""
    from io import BytesIO

    from openpyxl import load_workbook

    from core.infrastructure.pdf.report_excel import generar_reporte_excel

    contenido = generar_reporte_excel(
        titulo='Prueba',
        columnas=['nombre', 'n', 'marcador'],
        filas=[{'nombre': '=cmd|\' /c calc\'!A0', 'n': -5, 'marcador': '-'}],
        filtros=[('Busqueda', '=1+1')],
    )
    hoja = load_workbook(BytesIO(contenido)).active
    celdas = [celda for fila in hoja.iter_rows() for celda in fila if celda.value is not None]
    valores = {celda.value: celda.data_type for celda in celdas}
    assert valores["'=cmd|' /c calc'!A0"] == 's'
    assert valores["'=1+1"] == 's'
    assert valores[-5] == 'n'
    assert valores['-'] == 's'
