"""
Tests de las utilidades de archivos subidos/servidos y de su uso en las vistas.

Corrigen: (a) subidas con `archivo.name` sin sanear y sin validar tipo/tamaño,
(b) texto de excepciones filtrado al cliente, (c) URLs prefirmadas de SeaweedFS
(host interno `sw-s3`) entregadas al navegador en vez de servir el archivo por
Django.
"""
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIRequestFactory

from core.domain.exceptions import AlmacenamientoNoDisponible, NotFoundError, ValidationError
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import (
    MAX_BYTES_IMAGEN,
    TIPOS_IMAGEN,
    clave_segura,
    validar_archivo,
)
from core.presentation.archivos import respuesta_archivo

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 32
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


def _subido(nombre, contenido, tipo="image/jpeg"):
    return SimpleUploadedFile(nombre, contenido, content_type=tipo)


def test_validar_archivo_acepta_imagen_valida_y_deriva_el_mime_del_contenido():
    contenido, tipo, ext = validar_archivo(_subido("Foto.JPG", JPEG, "text/html"), TIPOS_IMAGEN, MAX_BYTES_IMAGEN)
    assert contenido == JPEG
    assert tipo.mime == "image/jpeg"  # no se confía en el Content-Type del cliente
    assert ext == ".jpg"


def test_validar_archivo_rechaza_extension_no_permitida():
    with pytest.raises(ValidationError):
        validar_archivo(_subido("shell.php", JPEG), TIPOS_IMAGEN, MAX_BYTES_IMAGEN)


def test_validar_archivo_rechaza_contenido_que_no_corresponde_a_la_extension():
    with pytest.raises(ValidationError):
        validar_archivo(_subido("foto.png", JPEG), TIPOS_IMAGEN, MAX_BYTES_IMAGEN)
    with pytest.raises(ValidationError):
        validar_archivo(_subido("foto.webp", b"RIFF" + b"0" * 8 + b"XXXX"), TIPOS_IMAGEN, MAX_BYTES_IMAGEN)


def test_validar_archivo_rechaza_tamano_excesivo():
    with pytest.raises(ValidationError):
        validar_archivo(_subido("foto.png", PNG + b"0" * 2048), TIPOS_IMAGEN, 1024)


def test_clave_segura_no_incluye_el_nombre_del_cliente():
    clave = clave_segura("perfiles", ".jpg")
    assert clave.startswith("perfiles/") and clave.endswith(".jpg")
    assert clave != clave_segura("perfiles", ".jpg")


def test_respuesta_archivo_sirve_por_streaming_sin_exponer_urls_de_almacenamiento():
    storage = MagicMock()
    storage.descargar_flujo.return_value = iter([b"ab", b"cd"])

    resp = respuesta_archivo(storage, "perfiles/abc.png")

    assert b"".join(resp.streaming_content) == b"abcd"
    assert resp["Content-Type"] == "image/png"
    assert resp["X-Content-Type-Options"] == "nosniff"
    storage.url_firmada.assert_not_called()


def test_respuesta_archivo_sin_clave_es_not_found():
    with pytest.raises(NotFoundError):
        respuesta_archivo(MagicMock(), "")


def test_storage_descargar_flujo_traduce_objeto_inexistente_a_not_found():
    class _ErrorS3(Exception):
        response = {"Error": {"Code": "NoSuchKey"}}

    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    cliente = MagicMock()
    cliente.get_object.side_effect = _ErrorS3()
    storage._s3_client = cliente

    with pytest.raises(NotFoundError):
        storage.descargar_flujo("perfiles/no-existe.jpg")


def test_storage_descargar_flujo_falla_cerrado_si_el_almacen_cae():
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    cliente = MagicMock()
    cliente.get_object.side_effect = RuntimeError("conexión rechazada")
    storage._s3_client = cliente

    with pytest.raises(AlmacenamientoNoDisponible):
        storage.descargar_flujo("perfiles/x.jpg")


def test_storage_descargar_flujo_devuelve_los_bloques_del_cuerpo():
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    cliente = MagicMock()
    cliente.get_object.return_value = {"Body": MagicMock(iter_chunks=lambda chunk_size: iter([b"x"]))}
    storage._s3_client = cliente

    assert list(storage.descargar_flujo("perfiles/x.jpg")) == [b"x"]


# --- Vistas ---------------------------------------------------------------

def _post_foto(archivo):
    from apps.personal.presentation.views.personal_views import EmpleadoFotoView

    request = APIRequestFactory().post("/api/v1/personal/123/foto/", {"file": archivo}, format="multipart")
    view = EmpleadoFotoView()
    return view, view.initialize_request(request)


def test_foto_empleado_post_rechaza_archivo_que_no_es_imagen():
    view, request = _post_foto(_subido("evil.html", b"<script>alert(1)</script>", "image/jpeg"))
    with patch("apps.personal.presentation.views.personal_views.SeaweedFSStorage") as storage:
        with pytest.raises(ValidationError):
            view.post(request, cedula="123")
    storage.return_value.subir.assert_not_called()


def test_foto_empleado_post_guarda_con_clave_uuid_y_devuelve_ruta_de_la_api():
    view, request = _post_foto(_subido("../../etc/passwd.png", PNG, "image/png"))
    with patch("apps.personal.presentation.views.personal_views.SeaweedFSStorage") as storage, \
            patch("apps.personal.presentation.views.personal_views.guardar_foto") as guardar:
        resp = view.post(request, cedula="123")

    clave = storage.return_value.subir.call_args.args[0]
    assert clave.startswith("perfiles/") and "passwd" not in clave and ".." not in clave
    assert storage.return_value.subir.call_args.args[2] == "image/png"
    assert guardar.call_args.kwargs["clave"] == clave
    assert resp.data["data"]["url"].startswith("/api/v1/personal/123/foto/")
    storage.return_value.url_firmada.assert_not_called()


def test_foto_empleado_get_sirve_el_binario_y_no_filtra_el_detalle_del_error():
    from apps.personal.presentation.views.personal_views import EmpleadoFotoView

    request = APIRequestFactory().get("/api/v1/personal/123/foto/")
    view = EmpleadoFotoView()
    with patch("apps.personal.presentation.views.personal_views.RepoPersonalORM") as repo, \
            patch("apps.personal.presentation.views.personal_views.SeaweedFSStorage") as storage:
        repo.return_value.obtener_clave_foto.return_value = "perfiles/abc.png"
        storage.return_value.descargar_flujo.return_value = iter([b"png"])
        resp = view.get(request, cedula="123")
        assert b"".join(resp.streaming_content) == b"png"

        storage.return_value.descargar_flujo.side_effect = AlmacenamientoNoDisponible("host interno sw-s3 caído")
        # el error de dominio lo traduce el handler global a un 503 genérico (no se captura `Exception` aquí)
        with pytest.raises(AlmacenamientoNoDisponible):
            view.get(request, cedula="123")


def test_foto_empleado_get_sin_foto_es_not_found():
    from apps.personal.presentation.views.personal_views import EmpleadoFotoView

    request = APIRequestFactory().get("/api/v1/personal/123/foto/")
    with patch("apps.personal.presentation.views.personal_views.RepoPersonalORM") as repo:
        repo.return_value.obtener_clave_foto.return_value = None
        with pytest.raises(NotFoundError):
            EmpleadoFotoView().get(request, cedula="123")


def test_mapper_personal_expone_ruta_de_la_api_en_vez_de_descargar_la_foto():
    from apps.personal.infrastructure.mappers.mapper_personal import ruta_foto

    assert ruta_foto("123", "perfiles/abc123.jpg") == "/api/v1/personal/123/foto/?v=abc123"


def test_configuracion_visual_urls_apuntan_a_la_api_no_a_seaweedfs():
    from apps.configuracion.presentation.views.configuracion_visual_views import _url_logo

    assert _url_logo("logo-principal", None) is None
    url = _url_logo("logo-principal", "configuracion/logo-principal/abc.png")
    assert url == "/api/v1/configuracion/visual/logo/logo-principal/"
    assert "sw-s3" not in url and "Signature" not in url


def test_documento_familiar_expone_ruta_de_la_api():
    from apps.familiares.infrastructure.mappers.mapper_familiares import documento_familiar_a_entidad

    modelo = MagicMock(pk=7, familymember_id=3, document_type="cedula", uploaded_at="2026-01-01")
    modelo.file = "familiares/3/abc.pdf"
    entidad = documento_familiar_a_entidad(modelo)
    assert entidad.ruta_archivo == "/api/v1/familiares/3/documentos/7/archivo/"


def test_logo_configuracion_post_rechaza_archivo_invalido_y_usa_clave_uuid():
    from apps.configuracion.presentation.views.configuracion_visual_views import ConfiguracionVisualLogoView

    view = ConfiguracionVisualLogoView()
    factory = APIRequestFactory()

    malo = view.initialize_request(factory.post("/x", {"file": _subido("logo.svg", b"<svg/>")}, format="multipart"))
    malo.user = MagicMock(pk=1)
    with pytest.raises(ValidationError):
        view.post(malo, campo="logo-principal")

    bueno = view.initialize_request(factory.post("/x", {"file": _subido("a b.png", PNG, "image/png")}, format="multipart"))
    bueno.user = MagicMock(pk=1)
    with patch("apps.configuracion.presentation.views.configuracion_visual_views.SeaweedFSStorage") as storage, \
            patch("apps.configuracion.presentation.views.configuracion_visual_views.guardar_logo_configuracion") as guardar, \
            patch("apps.configuracion.presentation.views.configuracion_visual_views.ConfiguracionVisualSerializer"):
        view.post(bueno, campo="logo-principal")
    clave = storage.return_value.subir.call_args.args[0]
    assert clave.startswith("configuracion/logo-principal/") and " " not in clave
    assert guardar.call_args.args[2] == clave
