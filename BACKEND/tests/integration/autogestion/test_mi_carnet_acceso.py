"""D3/FIX-O46: endpoint que expone `puede_ver_carnet` al menú/pestaña.

La regla se calcula en el backend (política de alcance configurable); el
frontend solo consume este booleano.
"""
from unittest.mock import patch

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.autogestion.presentation.views.autogestion_views import MiCarnetAccesoView

pytestmark = pytest.mark.django_db

URL = "/api/v1/autogestion/mi-carnet/acceso/"
PATCH = (
    "apps.autogestion.presentation.views.autogestion_views."
    "RepoPortalTrabajadorORM.puede_ver_carnet"
)


class Usuario:
    is_authenticated = True
    is_active = True
    pk = 1

    def __init__(self, cedula: str | None = "99000302"):
        self.cedula_id = cedula

    def tiene_permiso(self, codigo: str) -> bool:
        return codigo == "autogestion.ver_propio"


def _request(cedula: str | None = "99000302"):
    peticion = APIRequestFactory().get(URL)
    force_authenticate(peticion, user=Usuario(cedula))
    return peticion


@pytest.mark.parametrize(
    ("alcance", "esperado"),
    [
        ("nadie", False),
        ("todos", True),
        ("activos", True),
        ("pasivos", False),
        ("usuarios_especificos", True),
    ],
)
def test_endpoint_refleja_la_decision_del_backend(alcance: str, esperado: bool):
    with patch(PATCH, return_value=esperado) as evaluar:
        respuesta = MiCarnetAccesoView.as_view()(_request())

    assert respuesta.status_code == 200
    assert respuesta.data["data"]["puede_ver_carnet"] is esperado
    evaluar.assert_called_once_with("99000302")


def test_sin_cedula_devuelve_404_claro():
    respuesta = MiCarnetAccesoView.as_view()(_request(cedula=None))

    assert respuesta.status_code == 404
    assert "expediente" in respuesta.data["message"].lower()
