"""Permiso `personal.editar_nacionalidad`: cambiar la nacionalidad lo exige; sin cambio, no."""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.cedula_id = 'V-1'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def trabajador():
    venezolana = NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})[0]
    extranjera = NacionalidadModel.objects.get_or_create(pk=2, defaults={'codigo': 'E', 'nombre': 'Extranjera'})[0]
    sexo = SexoModel.objects.create(sexo='M')
    EmployeeModel.objects.create(
        cedulaidentidad='99004455', nombres='ANA', apellidos='PEREZ', sexoid=sexo, nacionalidad=venezolana,
    )
    return venezolana, extranjera


EDITAR = 'personal.editar_personales'
NAC = 'personal.editar_nacionalidad'


def test_cambiar_nacionalidad_con_permiso_da_200(trabajador):
    r = _cliente(EDITAR, NAC).patch('/api/v1/personal/99004455/', {'nacionalidad_id': 2}, format='json')
    assert r.status_code == 200, r.content
    assert EmployeeModel.objects.get(cedulaidentidad='99004455').nacionalidad_id == 2


def test_cambiar_nacionalidad_sin_permiso_da_403(trabajador):
    r = _cliente(EDITAR).patch('/api/v1/personal/99004455/', {'nacionalidad_id': 2}, format='json')
    assert r.status_code == 403
    assert 'nacionalidad' in r.json()['message'].lower()
    assert EmployeeModel.objects.get(cedulaidentidad='99004455').nacionalidad_id == 1


def test_sin_cambio_de_nacionalidad_no_exige_el_permiso(trabajador):
    r = _cliente(EDITAR).patch(
        '/api/v1/personal/99004455/', {'nacionalidad_id': 1, 'nombres': 'ANITA'}, format='json',
    )
    assert r.status_code == 200, r.content
