"""Encabezado de PDF: ningún PDF lleva el membrete de la institución (pedido 2026-11-04)."""
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Table

from core.infrastructure.pdf.pdf_components import create_header


def _texto_central(elementos) -> str:
    tabla = next(e for e in elementos if isinstance(e, Table))
    celda = tabla._cellvalues[0][1]
    return celda.text if isinstance(celda, Paragraph) else str(celda)


def test_por_defecto_ningun_pdf_muestra_el_membrete():
    texto = _texto_central(create_header('Reporte', 180 * mm))
    assert 'Comisión Nacional' not in texto and 'REPORTE' in texto


def test_se_puede_recuperar_el_membrete():
    assert 'COMISIÓN NACIONAL DE TELECOMUNICACIONES' in _texto_central(
        create_header('Reporte', 180 * mm, mostrar_institucion=True))


def test_sin_institucion_omite_el_membrete():
    texto = _texto_central(create_header('', 180 * mm, mostrar_institucion=False))
    assert 'Comisión Nacional' not in texto and 'CONATEL' not in texto


def test_la_constancia_usa_el_encabezado_sin_institucion():
    import inspect
    from apps.fe_de_vida.infrastructure.pdf import constancia_pdf
    assert 'mostrar_institucion=False' in inspect.getsource(constancia_pdf)
