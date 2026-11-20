"""Biblioteca de medios sembrada: no ofrecer filas sin archivo en SeaweedFS.

Cubre el defecto B-9: la siembra 0008 creó claves sin objeto. El comando
``verificar_biblioteca_institucional`` debe sembrar desde archivos entregados
(actualizando la misma fila) y retirar las filas fantasma cuando no hay archivo.
"""
from io import StringIO

import pytest
from django.core.management import call_command

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
)
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

# PNG válido de 1x1 (suficiente para validar firma binaria y dimensiones).
PNG_VALIDO = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?"
    b"\x00\x05\xfe\x02\xfe\xa74d\xaa\x00\x00\x00\x00IEND\xaeB`\x82"
)

CLAVE_LOGO = "logos/logo_conatel_oficial.png"
NOMBRE_LOGO = "Logo Oficial CONATEL"


class AlmacenFalso:
    """Sustituye a SeaweedFS en las pruebas: objetos en un diccionario."""

    def __init__(self, objetos=None):
        self.objetos = dict(objetos or {})
        self.subidas = 0

    def existe(self, clave):
        return clave in self.objetos

    def subir(self, clave, contenido, mime_type="application/octet-stream"):
        self.subidas += 1
        self.objetos[clave] = contenido
        return clave


@pytest.fixture
def almacen(monkeypatch):
    falso = AlmacenFalso()
    monkeypatch.setattr(
        SeaweedFSStorage, "existe", lambda self, clave: falso.existe(clave)
    )
    monkeypatch.setattr(
        SeaweedFSStorage,
        "subir",
        lambda self, clave, contenido, mime_type="application/octet-stream": (
            falso.subir(clave, contenido, mime_type)
        ),
    )
    return falso


@pytest.mark.django_db
def test_limpia_solo_la_fila_sembrada_sin_objeto(tmp_path, almacen):
    fantasma = ElementoBibliotecaModel.objects.create(
        nombre=NOMBRE_LOGO,
        categoria="logo",
        archivo_clave=CLAVE_LOGO,
        nombre_archivo="logo_conatel_oficial.png",
        tamano_bytes=24500,
        mime_type="image/png",
    )
    subido_por_usuario = ElementoBibliotecaModel.objects.create(
        nombre=NOMBRE_LOGO,
        categoria="logo",
        archivo_clave="carnet_biblioteca/abc_logo.png",
        nombre_archivo="logo.png",
        tamano_bytes=10,
        mime_type="image/png",
        creado_por_id=None,
    )
    salida = StringIO()

    call_command(
        "verificar_biblioteca_institucional",
        "--directorio",
        str(tmp_path),
        "--limpiar-huerfanos",
        stdout=salida,
        stderr=salida,
    )

    assert not ElementoBibliotecaModel.objects.filter(pk=fantasma.pk).exists()
    assert ElementoBibliotecaModel.objects.filter(pk=subido_por_usuario.pk).exists()
    assert "limpiado" in salida.getvalue()


@pytest.mark.django_db
def test_siembra_desde_archivo_entregado_sin_duplicar(tmp_path, almacen):
    fila = ElementoBibliotecaModel.objects.create(
        nombre=NOMBRE_LOGO,
        categoria="logo",
        archivo_clave=CLAVE_LOGO,
        nombre_archivo="logo_conatel_oficial.png",
        tamano_bytes=24500,
        mime_type="image/png",
    )
    ruta = tmp_path / "logos" / "logo_conatel_oficial.png"
    ruta.parent.mkdir(parents=True)
    ruta.write_bytes(PNG_VALIDO)
    salida = StringIO()

    call_command(
        "verificar_biblioteca_institucional",
        "--directorio",
        str(tmp_path),
        stdout=salida,
        stderr=salida,
    )

    fila.refresh_from_db()
    assert almacen.objetos[CLAVE_LOGO] == PNG_VALIDO
    assert fila.tamano_bytes == len(PNG_VALIDO)
    assert (fila.ancho_px, fila.alto_px) == (1, 1)
    assert ElementoBibliotecaModel.objects.filter(nombre=NOMBRE_LOGO).count() == 1

    # Segunda ejecución: no vuelve a subir ni duplica.
    call_command(
        "verificar_biblioteca_institucional",
        "--directorio",
        str(tmp_path),
        stdout=salida,
        stderr=salida,
    )
    assert almacen.subidas == 1
    assert ElementoBibliotecaModel.objects.filter(nombre=NOMBRE_LOGO).count() == 1


@pytest.mark.django_db
def test_sin_archivo_ni_limpieza_avisa_pero_conserva_la_fila(tmp_path, almacen):
    fila = ElementoBibliotecaModel.objects.create(
        nombre=NOMBRE_LOGO,
        categoria="logo",
        archivo_clave=CLAVE_LOGO,
        nombre_archivo="logo_conatel_oficial.png",
        tamano_bytes=24500,
        mime_type="image/png",
    )
    salida = StringIO()

    call_command(
        "verificar_biblioteca_institucional",
        "--directorio",
        str(tmp_path),
        stdout=salida,
        stderr=salida,
    )

    assert ElementoBibliotecaModel.objects.filter(pk=fila.pk).exists()
    assert "falta" in salida.getvalue()
