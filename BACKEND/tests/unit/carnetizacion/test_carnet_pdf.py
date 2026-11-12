"""
Tests unitarios del generador de PDF del carnet (Fase 2.3 del plan de
reparación, `PLAN_REPARACION_GATH.md`). Puro: reportlab/qrcode/PIL no
dependen de Django ni de la BD.
"""
from io import BytesIO

from PIL import Image

from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf


def _foto_de_prueba() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (200, 240), color=(10, 20, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_generar_carnet_pdf_sin_foto_ni_plantilla_produce_pdf_valido():
    datos = DatosCarnetPdf(
        nombre_completo="Juan Carlos Pérez",
        cedula="12345678",
        cargo="ANALISTA DE SISTEMAS",
        departamento="OFICINA DE TECNOLOGÍA",
        security_hash="hash-de-prueba-abc123",
    )
    pdf_bytes = generar_carnet_pdf(datos)
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 500


def test_generar_carnet_pdf_con_foto_produce_pdf_valido():
    datos = DatosCarnetPdf(
        nombre_completo="Ana Gómez",
        cedula="87654321",
        cargo="COORDINADOR",
        departamento="OFICINA DE GESTION HUMANA",
        security_hash="hash-de-prueba-def456",
        foto_bytes=_foto_de_prueba(),
    )
    pdf_bytes = generar_carnet_pdf(datos)
    assert pdf_bytes.startswith(b"%PDF")


def test_generar_carnet_pdf_con_nombre_largo_no_falla():
    """Réplica del ajuste de fuente del legado (`_calcular_tamano_fuente`/`_dividir_texto_en_lineas`)."""
    datos = DatosCarnetPdf(
        nombre_completo="María Fernanda Rodríguez De La Cruz Hernández",
        cedula="30111222",
        cargo="DIRECTOR GENERAL DE PLANIFICACIÓN Y PRESUPUESTO INSTITUCIONAL",
        departamento="DIRECCIÓN GENERAL DE ADMINISTRACIÓN Y FINANZAS",
        security_hash="hash-de-prueba-ghi789",
    )
    pdf_bytes = generar_carnet_pdf(datos)
    assert pdf_bytes.startswith(b"%PDF")


def test_generar_carnet_pdf_con_foto_corrupta_cae_a_placeholder():
    datos = DatosCarnetPdf(
        nombre_completo="Pedro Ramírez",
        cedula="20999888",
        cargo="TÉCNICO",
        departamento="OFICINA DE TECNOLOGÍA",
        security_hash="hash-de-prueba-jkl012",
        foto_bytes=b"esto-no-es-una-imagen-valida",
    )
    pdf_bytes = generar_carnet_pdf(datos)
    assert pdf_bytes.startswith(b"%PDF")


def test_reducir_foto_carnet_4k_queda_en_el_limite_y_en_jpeg():
    from apps.carnetizacion.infrastructure.pdf.carnet_pdf import LADO_FOTO_MIN_PX, reducir_foto_carnet

    buf = BytesIO()
    Image.new('RGB', (3840, 2160), (120, 80, 200)).save(buf, format='PNG')

    reducida = reducir_foto_carnet(buf.getvalue())

    with Image.open(BytesIO(reducida)) as img:
        assert max(img.size) <= LADO_FOTO_MIN_PX
        assert img.format == 'JPEG'


def test_reducir_foto_carnet_con_transparencia_conserva_png():
    from apps.carnetizacion.infrastructure.pdf.carnet_pdf import LADO_FOTO_MIN_PX, reducir_foto_carnet

    buf = BytesIO()
    Image.new('RGBA', (3000, 2000), (10, 20, 30, 128)).save(buf, format='PNG')

    with Image.open(BytesIO(reducir_foto_carnet(buf.getvalue()))) as img:
        assert max(img.size) <= LADO_FOTO_MIN_PX
        assert img.format == 'PNG'


def test_reducir_foto_perfil_4k_queda_a_800px_jpeg():
    from core.infrastructure.storage.imagenes import reducir_foto_perfil

    buf = BytesIO()
    Image.new('RGB', (3840, 2160), (1, 2, 3)).save(buf, format='PNG')
    datos, tipo, ext = reducir_foto_perfil(buf.getvalue())
    with Image.open(BytesIO(datos)) as img:
        assert max(img.size) <= 800
        assert img.format == 'JPEG'
    assert ext == '.jpg' and tipo.mime == 'image/jpeg'


def test_reducir_foto_perfil_endereza_exif():
    from core.infrastructure.storage.imagenes import reducir_foto_perfil

    img = Image.new('RGB', (400, 200), (9, 9, 9))
    exif = Image.Exif()
    exif[0x0112] = 6  # rotar 90 horario al mostrar: queda 200x400
    buf = BytesIO()
    img.save(buf, format='JPEG', exif=exif)
    datos, _, _ = reducir_foto_perfil(buf.getvalue())
    with Image.open(BytesIO(datos)) as out:
        assert out.size == (200, 400)
