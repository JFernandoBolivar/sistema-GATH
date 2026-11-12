"""TLF-1: orden de nacimiento y cédula sintética del hijo menor."""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.catalogos_soporte_models import GrupoSanguineoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db
BASE = '/api/v1/familiares/empleado/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=('familiares.crear',)):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos or ('familiares.crear',)))
    return api


@pytest.fixture
def datos():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='M')
    hijo = ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)')
    esposa = ParentescoModel.objects.create(descripcion_parentesco='ESPOSA')
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='99000320', nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo, total_anos_apn=0,
    )
    return {'sexo': sexo, 'hijo': hijo, 'esposa': esposa, 'empleado': empleado}


def _cuerpo(datos, *, orden=2, cedula=None, nacimiento='2022-01-01'):
    return {
        'primer_nombre': 'HIJO',
        'primer_apellido': 'PEREZ',
        'parentesco_id': datos['hijo'].pk,
        'fecha_nacimiento': nacimiento,
        'sexo_id': datos['sexo'].pk,
        'orden_hijo': orden,
        # OC 2026-11-11: el grupo sanguíneo es obligatorio.
        'perfil_salud': {
            'grupo_sanguineo_id': GrupoSanguineoModel.objects.get_or_create(
                GrupoSanguineo='O+',
            )[0].pk,
        },
        **({'cedula_familiar': cedula} if cedula else {}),
    }


def test_registro_genera_cedula_con_el_orden_elegido(datos):
    r = _cliente().post(BASE + '99000320/', _cuerpo(datos, orden=2), format='json')
    assert r.status_code == 200, r.content
    assert r.json()['data']['cedula_familiar'] == '99000320-2'
    assert r.json()['data']['orden_hijo'] == 2
    familiar = EmployeefamilyModel.objects.get(employeecedula_id='99000320')
    assert familiar.cedulaFamiliar == '99000320-2' and familiar.orden_hijo == 2


def test_registro_rechaza_orden_duplicado(datos):
    assert _cliente().post(BASE + '99000320/', _cuerpo(datos, orden=2), format='json').status_code == 200
    r = _cliente().post(BASE + '99000320/', _cuerpo(datos, orden=2), format='json')
    assert r.status_code == 400
    assert 'orden ingresado' in str(r.json())


def test_registro_exige_orden_para_hijo_menor(datos):
    r = _cliente().post(BASE + '99000320/', _cuerpo(datos, orden=None), format='json')
    assert r.status_code == 400
    assert 'orden_hijo' in str(r.json())


def test_registro_rechaza_fecha_futura(datos):
    r = _cliente().post(
        BASE + '99000320/',
        _cuerpo(datos, nacimiento='2099-01-01'),
        format='json',
    )
    assert r.status_code == 400
    assert 'futura' in str(r.json())


def test_registro_rechaza_orden_que_desborda_la_cedula(datos):
    """H2: 8 dígitos + '-' + orden 10 = 11 caracteres; debe ser 400 claro, no 500."""
    r = _cliente().post(BASE + '99000320/', _cuerpo(datos, orden=10), format='json')
    assert r.status_code == 400
    assert '10 caracteres' in str(r.json())
    assert not EmployeefamilyModel.objects.filter(employeecedula_id='99000320').exists()


def test_el_lector_de_autogestion_devuelve_la_cedula_que_se_generara(datos):
    """FIX hijo sin cédula: el lector devuelve la cédula y NO modifica el valor propuesto."""
    valores = _cuerpo(datos, orden=3)
    valores.pop('cedula_familiar', None)
    generada = LectorFichaORM().validar_familiar_alta('99000320', valores)
    assert generada == '99000320-3'
    assert 'cedula_generada' not in valores


def test_el_lector_de_autogestion_exige_orden(datos):
    valores = _cuerpo(datos, orden=None)
    with pytest.raises(ValidationError) as error:
        LectorFichaORM().validar_familiar_alta('99000320', valores)
    assert error.value.campo == 'orden_hijo'
