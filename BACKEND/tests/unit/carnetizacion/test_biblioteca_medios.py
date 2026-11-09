import pytest
from core.domain.exceptions import ValidationError
from apps.carnetizacion.domain.services.validador_multimedia import validar_archivo_biblioteca
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM

# PNG mínimo válido de 1x1 pixel
PNG_VALIDO = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa74d\xaa\x00\x00\x00\x00IEND\xaeB`\x82"

# SVG seguro
SVG_VALIDO = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
</svg>"""

# SVG malicioso con script
SVG_MALICIOSO = b"""<svg xmlns="http://www.w3.org/2000/svg" onload="alert('xss')">
  <script>evil()</script>
</svg>"""


def test_validador_png_valido():
    mime, tamano = validar_archivo_biblioteca(
        contenido=PNG_VALIDO,
        nombre_archivo="logo_conatel.png",
        categoria="logo",
    )
    assert mime == "image/png"
    assert tamano == len(PNG_VALIDO)


def test_validador_svg_valido():
    mime, tamano = validar_archivo_biblioteca(
        contenido=SVG_VALIDO,
        nombre_archivo="sello.svg",
        categoria="imagen",
    )
    assert mime == "image/svg+xml"
    assert tamano > 0


def test_validador_rechaza_svg_malicioso():
    with pytest.raises(ValidationError, match="scripts o atributos dinámicos"):
        validar_archivo_biblioteca(
            contenido=SVG_MALICIOSO,
            nombre_archivo="firma.svg",
            categoria="firma",
        )


def test_validador_rechaza_archivo_vacio():
    with pytest.raises(ValidationError, match="está vacío"):
        validar_archivo_biblioteca(
            contenido=b"",
            nombre_archivo="vacio.png",
            categoria="logo",
        )


def test_validador_rechaza_sobrepeso_firma():
    contenido_pesado = b"\x89PNG\r\n\x1a\n" + (b"0" * (2 * 1024 * 1024 + 10))
    with pytest.raises(ValidationError, match="supera el tamaño máximo permitido"):
        validar_archivo_biblioteca(
            contenido=contenido_pesado,
            nombre_archivo="firma_pesada.png",
            categoria="firma",
        )


class AlmacenEnMemoria:
    def __init__(self):
        self.archivos = {}

    def subir(self, clave, contenido, mime_type):
        self.archivos[clave] = contenido
        return clave

    def descargar(self, clave):
        return self.archivos.get(clave, b"")

    def eliminar(self, clave):
        self.archivos.pop(clave, None)


@pytest.mark.django_db
def test_repo_guardar_listar_y_eliminar_recurso_biblioteca():
    repo = RepoCarnetizacionORM(almacen=AlmacenEnMemoria())

    # Guardar logo
    logo = repo.guardar_elemento_biblioteca(
        nombre="Logo Institucional FITELVEN",
        categoria="logo",
        contenido=PNG_VALIDO,
        nombre_archivo="logo_fitelven.png",
        descripcion="Logo oficial para credenciales",
    )
    assert logo.id is not None
    assert logo.categoria == "logo"
    assert logo.mime_type == "image/png"
    assert logo.ancho_px == 1
    assert logo.alto_px == 1

    # Listar por categoría
    logos = repo.listar_elementos_biblioteca(categoria="logo")
    assert any(item.id == logo.id for item in logos)

    firmas = repo.listar_elementos_biblioteca(categoria="firma")
    assert not any(item.id == logo.id for item in firmas)

    # Eliminar
    eliminado = repo.eliminar_elemento_biblioteca(logo.id)
    assert eliminado is True
