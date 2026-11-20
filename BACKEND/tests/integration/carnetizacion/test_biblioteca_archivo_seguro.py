"""B-8: descarga segura de medios de la biblioteca.

La respuesta siempre es un adjunto con ``nosniff``; el ``Content-Type`` sale del
contenido real y los SVG históricos solo se sirven como SVG después de sanearlos.
"""
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
)
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

pytestmark = pytest.mark.django_db

BASE = "/api/v1/carnetizacion"

SVG_CON_SCRIPT = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">
  <script>alert('xss')</script>
  <circle cx="5" cy="5" r="4" fill="red" />
</svg>"""

SVG_CON_DOCTYPE = b"""<!DOCTYPE svg [<!ENTITY x "boom">]>
<svg xmlns="http://www.w3.org/2000/svg">&x;</svg>"""


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.pk = 1
        self.id = None
        self.cedula_id = "V-1"
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def _png() -> bytes:
    salida = BytesIO()
    Image.new('RGBA', (8, 8), (10, 20, 30, 255)).save(salida, 'PNG')
    return salida.getvalue()


def _jpeg() -> bytes:
    salida = BytesIO()
    Image.new('RGB', (8, 8), (10, 20, 30)).save(salida, 'JPEG')
    return salida.getvalue()


def _medio(monkeypatch, contenido: bytes, mime: str, nombre: str) -> ElementoBibliotecaModel:
    monkeypatch.setattr(SeaweedFSStorage, 'descargar', lambda self, _clave: contenido)
    return ElementoBibliotecaModel.objects.create(
        nombre="Medio de prueba",
        categoria="logo",
        archivo_clave=f"prueba/{nombre}",
        nombre_archivo=nombre,
        tamano_bytes=len(contenido),
        mime_type=mime,
    )


def _get(api, medio):
    respuesta = api.get(f"{BASE}/biblioteca/{medio.pk}/archivo/")
    assert respuesta.status_code == 200, respuesta.content
    return respuesta


def _sin_charset(respuesta) -> str:
    return respuesta['Content-Type'].split(';')[0].strip().lower()


def test_descarga_png_es_adjunto_con_nosniff(api, monkeypatch):
    contenido = _png()
    medio = _medio(monkeypatch, contenido, 'image/png', 'logo.png')

    respuesta = _get(api, medio)

    assert _sin_charset(respuesta) == 'image/png'
    assert respuesta['Content-Disposition'].startswith('attachment;')
    assert 'logo.png' in respuesta['Content-Disposition']
    assert respuesta['X-Content-Type-Options'] == 'nosniff'
    assert respuesta.content == contenido


def test_descarga_jpeg_es_adjunto_con_nosniff(api, monkeypatch):
    contenido = _jpeg()
    medio = _medio(monkeypatch, contenido, 'image/jpeg', 'firma.jpeg')

    respuesta = _get(api, medio)

    assert _sin_charset(respuesta) == 'image/jpeg'
    assert respuesta['Content-Disposition'].startswith('attachment;')
    assert respuesta['X-Content-Type-Options'] == 'nosniff'
    assert respuesta.content == contenido


def test_descarga_svg_historico_se_sanea_antes_de_servirlo(api, monkeypatch):
    medio = _medio(monkeypatch, SVG_CON_SCRIPT, 'image/svg+xml', 'sello.svg')

    respuesta = _get(api, medio)

    assert _sin_charset(respuesta) == 'image/svg+xml'
    assert respuesta['Content-Disposition'].startswith('attachment;')
    assert respuesta['X-Content-Type-Options'] == 'nosniff'
    assert "sandbox" in respuesta.get('Content-Security-Policy', '')
    cuerpo = respuesta.content.lower()
    assert b'<script' not in cuerpo
    assert b'onload' not in cuerpo
    assert b'alert' not in cuerpo
    assert b'<circle' in cuerpo


def test_svg_con_doctype_no_se_sirve_como_svg(api, monkeypatch):
    medio = _medio(monkeypatch, SVG_CON_DOCTYPE, 'image/svg+xml', 'viejo.svg')

    respuesta = _get(api, medio)

    assert _sin_charset(respuesta) == 'application/octet-stream'
    assert respuesta['Content-Disposition'].startswith('attachment;')
    assert respuesta['X-Content-Type-Options'] == 'nosniff'


def test_el_tipo_guardado_no_prevalece_sobre_el_contenido_real(api, monkeypatch):
    contenido = _png()
    medio = _medio(monkeypatch, contenido, 'image/svg+xml', 'mentira.svg')

    respuesta = _get(api, medio)

    assert _sin_charset(respuesta) == 'image/png'
    assert respuesta.content == contenido


def test_descarga_pdf_existente_sigue_funcionando(api, monkeypatch):
    contenido = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
    medio = _medio(monkeypatch, contenido, 'application/pdf', 'documento.pdf')

    respuesta = _get(api, medio)

    assert _sin_charset(respuesta) == 'application/pdf'
    assert respuesta['Content-Disposition'].startswith('attachment;')
    assert respuesta['X-Content-Type-Options'] == 'nosniff'
    assert respuesta.content == contenido


def test_subida_de_svg_se_rechaza_aunque_se_declare_png(api):
    # El nombre y el Content-Type mienten: el contenido real es un SVG activo.
    archivo = SimpleUploadedFile(
        'logo.png', SVG_CON_SCRIPT, content_type='image/png',
    )

    respuesta = api.post(
        f"{BASE}/biblioteca/",
        {'nombre': 'Logo falso', 'categoria': 'logo', 'archivo': archivo},
        format='multipart',
    )

    assert respuesta.status_code == 400, respuesta.content
    assert 'SVG no se aceptan' in respuesta.json()['message']


def test_subida_de_png_valido_se_acepta(api, monkeypatch):
    monkeypatch.setattr(SeaweedFSStorage, 'subir', lambda self, clave, _contenido, _mime: clave)
    contenido = _png()
    archivo = SimpleUploadedFile('logo.png', contenido, content_type='image/png')

    respuesta = api.post(
        f"{BASE}/biblioteca/",
        {'nombre': 'Logo válido', 'categoria': 'logo', 'archivo': archivo},
        format='multipart',
    )

    assert respuesta.status_code == 201, respuesta.content
    assert respuesta.json()['data']['mime_type'] == 'image/png'
    assert ElementoBibliotecaModel.objects.filter(nombre='Logo válido', mime_type='image/png').exists()
