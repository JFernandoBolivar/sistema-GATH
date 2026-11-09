"""Fase 2: caché Redis de catálogos, ETag e invalidación por escritura."""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.personal.infrastructure.models.catalogos_soporte_models import (
    NivelAcademicoModel,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/personal/catalogos/niveles-academicos/"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.pk = self.id = 1
        self.cedula_id = "V-1"
        self.rol = None

    def tiene_permiso(self, codigo):
        return True


def _cliente():
    api = APIClient()
    api.force_authenticate(user=Usuario())
    return api


def test_catalogo_se_cachea_y_devuelve_etag_y_cache_control():
    NivelAcademicoModel.objects.create(nivelacademico="PRIMARIA")
    api = _cliente()

    primera = api.get(URL)
    assert primera.status_code == 200
    assert primera["Cache-Control"] == "private, max-age=300"
    assert primera["ETag"].startswith('"')

    with CaptureQueriesContext(connection) as consultas:
        segunda = api.get(URL)
    assert segunda.status_code == 200
    assert len(consultas) == 0, [c["sql"] for c in consultas.captured_queries]
    assert segunda.json() == primera.json()


def test_if_none_match_devuelve_304():
    NivelAcademicoModel.objects.create(nivelacademico="SECUNDARIA")
    api = _cliente()
    primera = api.get(URL)

    respuesta = api.get(URL, HTTP_IF_NONE_MATCH=primera["ETag"])

    assert respuesta.status_code == 304
    assert respuesta["ETag"] == primera["ETag"]


def test_invalidar_no_falla_si_la_cache_no_responde(monkeypatch):
    import core.presentation.cache_catalogos as modulo

    class CacheCaida:
        def incr(self, *args, **kwargs):
            raise ConnectionError("redis caído")

        def set(self, *args, **kwargs):
            raise ConnectionError("redis caído")

    monkeypatch.setattr(modulo, "cache", CacheCaida())

    # No debe propagar: la escritura del catálogo tiene que completarse.
    modulo.invalidar_catalogos()


def test_escribir_un_catalogo_invalida_la_cache():
    NivelAcademicoModel.objects.create(nivelacademico="INICIAL")
    api = _cliente()
    api.get(URL)

    NivelAcademicoModel.objects.create(nivelacademico="UNIVERSITARIO")

    with CaptureQueriesContext(connection) as consultas:
        respuesta = api.get(URL)
    assert len(consultas) > 0
    nombres = [item["nombre"] for item in respuesta.json()["data"]]
    assert "UNIVERSITARIO" in nombres
