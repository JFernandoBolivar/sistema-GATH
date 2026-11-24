"""Ayudas comunes de las pruebas de documentos: PDF de fondo, extracción de texto y definiciones mínimas."""
import subprocess
import tempfile
from io import BytesIO

from reportlab.pdfgen import canvas


def pdf_fondo(paginas=2, ancho=540, alto=720) -> bytes:
    b = BytesIO()
    c = canvas.Canvas(b, pagesize=(ancho, alto))
    for n in range(paginas):
        c.drawString(40, alto - 40, f'FORMULARIO OFICIAL PAGINA {n + 1}')
        c.rect(30, 30, ancho - 60, alto - 60)
        c.showPage()
    c.save()
    return b.getvalue()


def texto_de(pdf: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
        f.write(pdf)
        f.flush()
        return subprocess.run(['pdftotext', '-layout', f.name, '-'], capture_output=True, text=True, check=True).stdout


def paginas_de(pdf: bytes) -> int:
    with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
        f.write(pdf)
        f.flush()
        info = subprocess.run(['pdfinfo', f.name], capture_output=True, text=True, check=True).stdout
    return int(next(l for l in info.splitlines() if l.startswith('Pages:')).split()[1])


def imagenes_de(pdf: bytes) -> int:
    with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
        f.write(pdf)
        f.flush()
        salida = subprocess.run(['pdfimages', '-list', f.name], capture_output=True, text=True, check=True).stdout
    return max(0, len(salida.strip().splitlines()) - 2)


def definicion_formulario():
    return {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'institucional', 'titulo': 'Documento de prueba', 'subtitulo': 'Subtítulo'},
        'bloques': [
            {'id': 'a', 'tipo': 'seccion', 'titulo': 'Datos personales'},
            {'id': 'b', 'tipo': 'fila_campos', 'celdas': [
                {'etiqueta': 'Apellidos y nombres', 'variable': 'nombre_completo', 'ancho': 3},
                {'etiqueta': 'Cédula', 'variable': 'cedula', 'ancho': 1},
                {'etiqueta': 'Firma a mano', 'variable': None, 'ancho': 1}]},
            {'id': 'c', 'tipo': 'casillas', 'etiqueta': 'Sexo', 'variable': 'sexo', 'columnas': 2,
             'opciones': [{'valor': 'MASCULINO', 'etiqueta': 'Masculino'}, {'valor': 'FEMENINO', 'etiqueta': 'Femenino'}]},
            {'id': 'd', 'tipo': 'tabla', 'titulo': 'Grupo familiar', 'coleccion': 'familiares', 'filas_minimas': 3,
             'columnas': [{'variable': 'nombre_completo', 'etiqueta': 'Nombre', 'ancho': 4},
                          {'variable': 'parentesco', 'etiqueta': 'Parentesco', 'ancho': 2}]},
            {'id': 'e', 'tipo': 'parrafo', 'texto': 'Yo, {nombre_completo}, declaro aspirar a {propio.sueldo}.', 'alineacion': 'justificado'},
            {'id': 'f', 'tipo': 'foto', 'alineacion': 'derecha'},
            {'id': 'g', 'tipo': 'salto_pagina'},
            {'id': 'h', 'tipo': 'firmas', 'firmantes': [{'etiqueta': 'FIRMA DEL TRABAJADOR'}, {'etiqueta': 'RECIBIDO POR'}]},
        ],
    }


CAMPOS_PROPIOS = [{'clave': 'sueldo', 'etiqueta': 'Sueldo al que aspira', 'tipo': 'texto', 'obligatorio': True}]


def definicion_overlay(origen=(1,)):
    return {'paginas': [{'origen': o, 'campos': [
        {'id': f'n{o}', 'tipo': 'texto', 'texto': '{nombre_completo}', 'x': 20, 'y': 30, 'w': 100, 'h': 7, 'tamano': 10},
        {'id': f's{o}', 'tipo': 'casilla', 'x': 20, 'y': 50, 'w': 5, 'h': 5,
         'condicion': {'variable': 'sexo', 'operador': 'igual', 'valor': 'MASCULINO'}},
        {'id': f't{o}', 'tipo': 'tabla', 'coleccion': 'familiares', 'x': 20, 'y': 70, 'w': 150, 'h': 30,
         'interlineado': 7, 'filas_max': 3, 'columnas': [{'variable': 'nombre_completo', 'dx': 0, 'ancho': 90},
                                                         {'variable': 'parentesco', 'dx': 95, 'ancho': 40}]},
    ]} for o in origen]}
