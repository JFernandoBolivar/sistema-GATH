"""
Pruebas de integración: parentescos (uso familiar vs contacto, alta y validación de familiares).
"""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import ParentescoModel
from apps.familiares.presentation.serializers.familiares_serializers import (
    RegistrarFamiliarInputSerializer,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db

URL = '/api/v1/catalogos/parentescos/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def parentescos_base():
    p_madre = ParentescoModel.objects.create(
        descripcion_parentesco='MADRE',
        aplica_familiar=True,
    )
    p_vecino = ParentescoModel.objects.create(
        descripcion_parentesco='VECINO(A)',
        aplica_familiar=False,
    )
    return {'madre': p_madre, 'vecino': p_vecino}


def test_listado_parentesco_uso_familiar_solo_devuelve_permitidos(parentescos_base):
    r = _cliente('catalogos.ver').get(URL, {'uso': 'familiar'})
    assert r.status_code == 200
    nombres = [p['nombre'] for p in r.json()['data']]
    assert 'MADRE' in nombres
    assert 'VECINO(A)' not in nombres


def test_listado_parentesco_uso_contacto_devuelve_todos(parentescos_base):
    r = _cliente('catalogos.ver').get(URL, {'uso': 'contacto'})
    assert r.status_code == 200
    nombres = [p['nombre'] for p in r.json()['data']]
    assert 'MADRE' in nombres
    assert 'VECINO(A)' in nombres


def test_crear_parentesco_nuevo_contacto_crea_con_aplica_familiar_false(parentescos_base):
    r = _cliente('catalogos.crear').post(
        URL,
        {'descripcion': 'compañero de trabajo', 'uso': 'contacto'},
        format='json',
    )
    assert r.status_code == 201, r.content
    data = r.json()['data']
    assert data['nombre'] == 'COMPAÑERO DE TRABAJO'
    assert data.get('extra', {}).get('aplica_familiar') is False

    creado = ParentescoModel.objects.get(descripcion_parentesco='COMPAÑERO DE TRABAJO')
    assert creado.aplica_familiar is False


def test_crear_parentesco_rechaza_duplicado_case_insensitive(parentescos_base):
    r = _cliente('catalogos.crear').post(
        URL,
        {'descripcion': 'madre', 'uso': 'contacto'},
        format='json',
    )
    assert r.status_code == 400
    res = r.json()
    errores = res.get('data', {}).get('errores', {})
    assert 'descripcion' in errores


def test_crear_parentesco_rechaza_longitud_invalida(parentescos_base):
    r = _cliente('catalogos.crear').post(
        URL,
        {'descripcion': 'A', 'uso': 'contacto'},
        format='json',
    )
    assert r.status_code == 400
    res = r.json()
    errores = res.get('data', {}).get('errores', {})
    assert 'descripcion' in errores


def test_crear_parentesco_rechaza_uso_invalido(parentescos_base):
    r = _cliente('catalogos.crear').post(
        URL,
        {'descripcion': 'AMIGO', 'uso': 'familiar'},
        format='json',
    )
    assert r.status_code == 400
    res = r.json()
    errores = res.get('data', {}).get('errores', {})
    assert 'uso' in errores


def test_crear_parentesco_sin_permiso_es_denegado():
    r = _cliente('catalogos.ver').post(
        URL,
        {'descripcion': 'AMIGO', 'uso': 'contacto'},
        format='json',
    )
    assert r.status_code == 403


def test_registrar_familiar_rechaza_parentesco_con_aplica_familiar_false(parentescos_base):
    # Creamos un empleado mínimo para la prueba
    from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    emp, _ = EmployeeModel.objects.get_or_create(
        cedulaidentidad='99000301',
        defaults={
            'nombres': 'TEST',
            'apellidos': 'EMPLEADO',
            'sexoid': sexo,
            'nacionalidad_id': 1,
        },
    )
    datos = {
        'empleado_cedula': str(emp.cedulaidentidad),
        'primer_nombre': 'JUAN',
        'primer_apellido': 'PEREZ',
        'cedula_familiar': '99000302',
        'parentesco_id': parentescos_base['vecino'].pk,  # aplica_familiar = False
        'fecha_nacimiento': '2000-01-01',
        'sexo_id': 1,
    }
    serializer = RegistrarFamiliarInputSerializer(data=datos)
    assert not serializer.is_valid()
    # El error viaja con el nombre real del campo para que el formulario lo ubique.
    assert 'parentesco_id' in serializer.errors
