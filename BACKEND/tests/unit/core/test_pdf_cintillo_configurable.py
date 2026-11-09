"""
Tests del motor de PDF (ReportLab) con el cintillo configurable (HU 0009).
No usan BD: solo verifican que `generar_reporte_pdf` renderiza sin errores
en los 3 escenarios reales (sin tocar SeaweedFS -- los bytes se simulan).
"""
import os

from core.infrastructure.pdf.pdf_components import _ASSETS_DIR
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf

TITULO = 'Reporte de prueba'
COLUMNAS = ['#', 'codigo', 'cedula']
FILAS = [{'#': 1, 'codigo': 'A1', 'cedula': '123'}]


def _bytes_asset(nombre: str) -> bytes:
    with open(os.path.join(_ASSETS_DIR, nombre), 'rb') as f:
        return f.read()


def test_config_none_preserva_el_comportamiento_legado():
    pdf = generar_reporte_pdf(TITULO, COLUMNAS, FILAS)
    assert pdf.startswith(b'%PDF')


def test_config_fijo_con_imagenes_y_texto_libre_escapado():
    config = {
        'tipo_cintillo': 'FIJO',
        'nombre_empresa': 'Empresa de Prueba & Cía <script>alert(1)</script>',
        'logo_principal_bytes': _bytes_asset('logo01.png'),
        'logo_secundario_bytes': None,  # cae al asset hardcodeado de respaldo
        'cintillo_pie_bytes': _bytes_asset('cintillo2.png'),
    }
    pdf = generar_reporte_pdf(TITULO, COLUMNAS, FILAS, config=config)
    assert pdf.startswith(b'%PDF')


def test_config_generico_no_usa_logos_institucionales():
    pdf_generico = generar_reporte_pdf(TITULO, COLUMNAS, FILAS, config={'tipo_cintillo': 'GENERICO'})
    pdf_legado = generar_reporte_pdf(TITULO, COLUMNAS, FILAS)
    assert pdf_generico.startswith(b'%PDF')
    # El genérico, sin logos ni cintillo de pie, es sustancialmente más
    # liviano que el PDF con las 3 imágenes institucionales.
    assert len(pdf_generico) < len(pdf_legado)
