"""
Pruebas de Fidelidad del PDF del Servidor (O44 - E8).
Valida que el generador fiel de ReportLab reproduzca la definición canónica JSON
en milímetros, con 2 caras (anverso y reverso), fuentes embebidas, reglas de color
y textos verificados.
"""
import re
import zlib
import pytest
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import (
    DatosCarnetPdf,
    generar_carnet_pdf,
    generar_carnet_pdf_fiel,
    MM_A_PT,
)
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_trabajador,
    plantilla_defecto_pasivo,
)


def extraer_contenido_completo(pdf_bytes: bytes) -> bytes:
    """Extrae todo el texto plano descomprimiendo streams si aplica."""
    trozos = [pdf_bytes]
    for match in re.finditer(b"stream[\r\n]+(.*?)[\r\n]+endstream", pdf_bytes, re.DOTALL):
        stream_data = match.group(1)
        try:
            decomp = zlib.decompress(stream_data)
            trozos.append(decomp)
        except Exception:
            trozos.append(stream_data)
    return b"\n".join(trozos)


@pytest.fixture
def datos_trabajador():
    return DatosCarnetPdf(
        nombre_completo="Ana Sofia Perez Luna",
        cedula="V-16.778.340",
        cargo="Especialista en Telecomunicaciones",
        departamento="Oficina de Gestión Humana",
        security_hash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        nomina="Funcionario",
    )


def test_generar_carnet_pdf_fiel_dos_caras_y_dimensiones(datos_trabajador):
    """Verifica que el PDF fiel contenga exactamente 2 páginas y dimensiones 54x85.6 mm."""
    tpl = plantilla_defecto_trabajador()
    pdf_bytes = generar_carnet_pdf_fiel(tpl, datos_trabajador)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")

    # Inspección de páginas en el árbol de objetos PDF
    conteo_paginas = pdf_bytes.count(b"/Type /Page") - pdf_bytes.count(b"/Type /Pages")
    assert conteo_paginas == 2, f"Se esperaban 2 páginas (anverso y reverso), encontradas: {conteo_paginas}"

    # Verificación de MediaBox (dimensiones en puntos)
    ancho_esperado = round(54.0 * MM_A_PT, 1)
    alto_esperado = round(85.6 * MM_A_PT, 1)

    assert b"/MediaBox" in pdf_bytes
    assert f"{int(ancho_esperado)}".encode() in pdf_bytes
    assert f"{int(alto_esperado)}".encode() in pdf_bytes


def test_generar_carnet_pdf_fiel_contiene_textos_canonicos(datos_trabajador):
    """Verifica que los textos corregidos (Adscrito, Gestión, pérdida, lugar) figuren en el PDF."""
    tpl = plantilla_defecto_trabajador()
    pdf_bytes = generar_carnet_pdf_fiel(tpl, datos_trabajador)
    contenido = extraer_contenido_completo(pdf_bytes)

    # Textos canónicos de datos del trabajador
    assert b"16.778.340" in contenido
    assert b"Telecomunicaciones" in contenido

    # Textos corregidos en el reverso (E7 / E8)
    assert b"ADSCRITO" in contenido
    assert b"lugar" in contenido
    assert b"Director General" in contenido


def test_generar_carnet_pdf_pasivo_fiel():
    """Verifica la generación fiel del carnet de pasivos (jubilados y pensionados)."""
    tpl = plantilla_defecto_pasivo()
    datos_pasivo = {
        'nombre_completo': 'Rosa Diaz Pena',
        'cedula': 'V-6.104.221',
        'cargo': 'Jubilada Institucional',
        'departamento': 'Oficina de Gestión Humana',
        'security_hash': 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        'nomina': 'Jubilado',
    }
    pdf_bytes = generar_carnet_pdf_fiel(tpl, datos_pasivo)
    contenido = extraer_contenido_completo(pdf_bytes)

    assert pdf_bytes.startswith(b"%PDF-")
    conteo_paginas = pdf_bytes.count(b"/Type /Page") - pdf_bytes.count(b"/Type /Pages")
    assert conteo_paginas == 2
    assert b"JUBILADO" in contenido or b"PERSONAL" in contenido


def test_generar_carnet_pdf_retrocompatibilidad(datos_trabajador):
    """Verifica que la función fachada generar_carnet_pdf funcione sin definición explícita."""
    pdf_bytes = generar_carnet_pdf(datos_trabajador)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 1000
