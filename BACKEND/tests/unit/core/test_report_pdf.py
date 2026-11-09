"""
Tests unitarios del motor genérico de reportes PDF (Fase 2.4 del plan de
reparación, `PLAN_REPARACION_GATH.md`). Puro: reportlab no depende de
Django ni de la BD.
"""
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf


def test_generar_reporte_pdf_con_filas_produce_pdf_valido():
    pdf_bytes = generar_reporte_pdf(
        titulo="Reporte de Personal Activo",
        columnas=['cedula', 'nombres', 'apellidos', 'correo'],
        filas=[
            {'cedula': '12345678', 'nombres': 'Juan', 'apellidos': 'Pérez', 'correo': 'juan@conatel.gob.ve'},
            {'cedula': '87654321', 'nombres': 'Ana', 'apellidos': 'Gómez', 'correo': None},
        ],
    )
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 500


def test_generar_reporte_pdf_sin_filas_no_falla():
    pdf_bytes = generar_reporte_pdf(titulo="Reporte Vacío", columnas=['id', 'nombre'], filas=[])
    assert pdf_bytes.startswith(b"%PDF")


def test_generar_reporte_pdf_orientacion_portrait():
    pdf_bytes = generar_reporte_pdf(
        titulo="Reporte Corto", columnas=['a', 'b'], filas=[{'a': 1, 'b': 2}], orientation='portrait',
    )
    assert pdf_bytes.startswith(b"%PDF")


def test_generar_reporte_pdf_muchas_filas_pagina_multiple():
    filas = [{'cedula': str(i), 'nombres': f'Empleado {i}'} for i in range(200)]
    pdf_bytes = generar_reporte_pdf(titulo="Reporte Grande", columnas=['cedula', 'nombres'], filas=filas)
    assert pdf_bytes.startswith(b"%PDF")
