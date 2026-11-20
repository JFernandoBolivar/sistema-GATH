"""Subida a la biblioteca: PDF solo como «fondo» (decisión 2026-11-20) y límite de píxeles (K-5)."""
import struct
import zlib
from io import BytesIO

import pytest
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.services.validador_multimedia import validar_archivo_biblioteca
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db


class AlmacenMemoria:
    def __init__(self):
        self.objetos = {}

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        self.objetos[clave] = contenido
        return clave

    def descargar(self, clave):
        return self.objetos[clave]

    def eliminar(self, clave):
        self.objetos.pop(clave, None)


def _pdf(ancho=300, alto=400):
    b = BytesIO()
    c = canvas.Canvas(b, pagesize=(ancho, alto))
    c.drawString(10, 10, 'fondo')
    c.save()
    return b.getvalue()


def _png_cabecera(ancho, alto):
    """PNG mínimo válido de cabecera con dimensiones arbitrarias (sin decodificar píxeles)."""
    def trozo(tipo, datos):
        return struct.pack('>I', len(datos)) + tipo + datos + struct.pack('>I', zlib.crc32(tipo + datos))
    ihdr = struct.pack('>IIBBBBB', ancho, alto, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + trozo(b'IHDR', ihdr) + trozo(b'IDAT', zlib.compress(b'\x00')) + trozo(b'IEND', b'')


def test_un_pdf_solo_se_acepta_en_la_categoria_fondo():
    assert validar_archivo_biblioteca(_pdf(), 'fondo.pdf', 'fondo')[0] == 'application/pdf'
    with pytest.raises(ValidationError, match='Fondo'):
        validar_archivo_biblioteca(_pdf(), 'logo.pdf', 'logo')


def test_subir_un_pdf_de_fondo_valido_y_rechazar_uno_enorme():
    repo = RepoCarnetizacionORM(almacen=AlmacenMemoria())
    guardado = repo.guardar_elemento_biblioteca('Fondo', 'fondo', _pdf(), 'fondo.pdf')
    assert guardado.mime_type == 'application/pdf'
    with pytest.raises(ValidationError, match='demasiado grande'):
        repo.guardar_elemento_biblioteca('Enorme', 'fondo', _pdf(14400, 14400), 'enorme.pdf')


def test_una_imagen_de_demasiados_pixeles_se_rechaza_al_subir():
    repo = RepoCarnetizacionORM(almacen=AlmacenMemoria())
    with pytest.raises(ValidationError, match='megapíxeles'):
        repo.guardar_elemento_biblioteca('Bomba', 'imagen', _png_cabecera(13000, 13000), 'bomba.png')
