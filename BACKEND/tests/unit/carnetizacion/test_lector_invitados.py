"""Lector de invitados (XLSX/CSV): mensajes y límites de la API, sin BD."""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from apps.carnetizacion.infrastructure.lectores.lector_invitados import (
    leer_archivo_invitados,
)
from core.domain.exceptions import ValidationError
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_DOCUMENTO


def _csv(contenido: str, nombre: str = 'invitados.csv') -> SimpleUploadedFile:
    return SimpleUploadedFile(nombre, contenido.encode('utf-8'), content_type='text/csv')


def _xlsx(filas: list[list[str]], nombre: str = 'invitados.xlsx') -> SimpleUploadedFile:
    wb = Workbook()
    ws = wb.active
    for fila in filas:
        ws.append(fila)
    buffer = io.BytesIO()
    wb.save(buffer)
    return SimpleUploadedFile(nombre, buffer.getvalue())


def test_lee_csv_como_diccionarios():
    archivo = _csv('nombre,correo\nAna,ana@conatel.gob.ve\nLuis,luis@conatel.gob.ve\n')

    filas = leer_archivo_invitados(archivo)

    assert filas == [
        {'nombre': 'Ana', 'correo': 'ana@conatel.gob.ve'},
        {'nombre': 'Luis', 'correo': 'luis@conatel.gob.ve'},
    ]


def test_lee_xlsx_y_descarta_filas_vacias():
    archivo = _xlsx([
        ['nombre', 'correo'],
        ['Ana', 'ana@conatel.gob.ve'],
        [None, None],
    ])

    filas = leer_archivo_invitados(archivo)

    assert filas == [{'nombre': 'Ana', 'correo': 'ana@conatel.gob.ve'}]


def test_excel_vacio_conserva_el_mensaje_de_la_api():
    with pytest.raises(ValidationError) as error:
        leer_archivo_invitados(_xlsx([]))

    assert str(error.value) == 'El archivo Excel está vacío'


def test_rechaza_extensiones_no_admitidas():
    with pytest.raises(ValidationError) as error:
        leer_archivo_invitados(_csv('nombre\nAna\n', nombre='invitados.txt'))

    assert str(error.value) == 'El archivo debe ser .xlsx o .csv.'


def test_rechaza_archivos_demasiado_grandes():
    class ArchivoGrande:
        name = 'invitados.csv'
        size = MAX_BYTES_DOCUMENTO + 1

    with pytest.raises(ValidationError) as error:
        leer_archivo_invitados(ArchivoGrande())

    assert 'tamaño máximo' in str(error.value)


def test_csv_ilegible_da_un_mensaje_claro():
    class ArchivoRoto:
        name = 'invitados.csv'
        size = 10

        def read(self):
            raise OSError('disco')

    with pytest.raises(ValidationError) as error:
        leer_archivo_invitados(ArchivoRoto())

    assert 'No se pudo leer el archivo CSV' in str(error.value)
