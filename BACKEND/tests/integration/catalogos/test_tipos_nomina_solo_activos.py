"""A-12: `solo_activos` en el catálogo de tipos de nómina, simétrico a pasivos."""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import TipoNominaModel

pytestmark = pytest.mark.django_db

URL = "/api/v1/catalogos/tipos-nomina/"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.cedula_id = "V-1"
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente():
    api = APIClient()
    api.force_authenticate(user=Usuario(["catalogos.ver"]))
    return api


@pytest.fixture
def nominas():
    TipoNominaModel.objects.create(nomina="CONTRATADO", es_activo=True)
    TipoNominaModel.objects.create(nomina="OBRERO FIJO", es_activo=True)
    TipoNominaModel.objects.create(nomina="JUBILADO", es_activo=False)
    TipoNominaModel.objects.create(nomina="PENSIONADO", es_activo=False)


def _nombres(respuesta):
    return sorted(item["nombre"] for item in respuesta.json()["data"])


def test_sin_parametro_devuelve_todas(nominas):
    respuesta = _cliente().get(URL)

    assert respuesta.status_code == 200
    assert _nombres(respuesta) == ["CONTRATADO", "JUBILADO", "OBRERO FIJO", "PENSIONADO"]


def test_solo_activos_devuelve_solo_es_activo_true(nominas):
    respuesta = _cliente().get(f"{URL}?solo_activos=true")

    assert respuesta.status_code == 200
    assert _nombres(respuesta) == ["CONTRATADO", "OBRERO FIJO"]


def test_solo_pasivos_sigue_devolviendo_solo_es_activo_false(nominas):
    respuesta = _cliente().get(f"{URL}?solo_pasivos=true")

    assert respuesta.status_code == 200
    assert _nombres(respuesta) == ["JUBILADO", "PENSIONADO"]
