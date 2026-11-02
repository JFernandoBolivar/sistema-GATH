"""L-01: Mi expediente se cachea y se invalida con las escrituras del expediente."""
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.autogestion.presentation.views.autogestion_views import MiExpedienteView
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db
CEDULA = '99000777'


class Usuario:
    is_authenticated = True
    is_active = True
    pk = 1

    def __init__(self):
        self.cedula_id = CEDULA

    def tiene_permiso(self, codigo):
        return codigo == 'autogestion.ver_propio'


def _request():
    request = APIRequestFactory().get('/api/v1/autogestion/mi-expediente/')
    force_authenticate(request, user=Usuario())
    return request


@patch('apps.autogestion.presentation.views.autogestion_views.serializar_mi_expediente')
@patch('apps.autogestion.presentation.views.autogestion_views.obtener_mi_expediente')
def test_mi_expediente_usa_cache_y_la_invalida_al_guardar_empleado(mock_uc, mock_serializar):
    cache.clear()
    mock_uc.return_value = SimpleNamespace(empleado=None, familiares=[], carnets=[])
    mock_serializar.return_value = {'empleado': {'cedula': CEDULA}}
    view = MiExpedienteView.as_view()

    assert view(_request()).status_code == 200
    assert view(_request()).status_code == 200
    assert mock_uc.call_count == 1

    SexoModel.objects.create(sexo='M')
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'}
    )
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA,
        nombres='CACHE',
        apellidos='EXPEDIENTE',
        sexoid=SexoModel.objects.first(),
        nacionalidad_id=1,
    )

    assert view(_request()).status_code == 200
    assert mock_uc.call_count == 2
