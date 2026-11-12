"""OC 2026-11-11 (punto 7): un familiar no puede tener la cédula de su titular.

La comparación es EXACTA: la cédula sintética `<titular>-<n>` de los hijos
menores sigue permitida.
"""
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
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.infrastructure.adaptadores_autogestion import ValidadorCambiosActaORM
from apps.personal.infrastructure.models.catalogos_soporte_models import GrupoSanguineoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db
BASE = '/api/v1/familiares/empleado/'
CEDULA = '99000340'
MENSAJE = 'La cédula del familiar no puede ser la misma del titular'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.cedula_id, self.pk, self.id, self.rol = '1', 1, 1, None
        self._permisos = {'familiares.crear', 'familiares.editar', 'familiares.ver'}

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente() -> APIClient:
    api = APIClient()
    api.force_authenticate(user=Usuario())
    return api


@pytest.fixture
def datos():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='M')
    hijo = ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)')
    grupo = GrupoSanguineoModel.objects.create(GrupoSanguineo='O+')
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo, total_anos_apn=0,
    )
    return {'sexo': sexo, 'hijo': hijo, 'grupo': grupo}


def _cuerpo(datos, **extra):
    cuerpo = {
        'cedula_familiar': '12345678',
        'primer_nombre': 'FAMILIAR',
        'segundo_nombre': None,
        'primer_apellido': 'PEREZ',
        'segundo_apellido': None,
        'parentesco_id': datos['hijo'].pk,
        'orden_hijo': None,
        'fecha_nacimiento': '2010-01-01',
        'sexo_id': datos['sexo'].pk,
        'mismo_ente': False,
        'heredero': False,
        'observaciones': None,
        'perfil_salud': {
            'grupo_sanguineo_id': datos['grupo'].pk,
            'alergias': [],
            'patologias_cronicas': [],
            'discapacidades': [],
        },
    }
    cuerpo.update(extra)
    return cuerpo


def test_registro_rechaza_la_cedula_exacta_del_titular(datos):
    respuesta = _cliente().post(
        BASE + f'{CEDULA}/', _cuerpo(datos, cedula_familiar=CEDULA), format='json',
    )

    assert respuesta.status_code == 400
    assert MENSAJE in str(respuesta.json())


def test_registro_acepta_la_sintetica_del_hijo_menor(datos):
    """`<titular>-1` no es igual a `<titular>`: el hijo menor sin cédula entra."""
    cuerpo = _cuerpo(
        datos, cedula_familiar=None, fecha_nacimiento='2022-01-01', orden_hijo=1,
    )

    respuesta = _cliente().post(BASE + f'{CEDULA}/', cuerpo, format='json')

    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json()['data']['cedula_familiar'] == f'{CEDULA}-1'


def test_actualizacion_rechaza_una_fila_legada_con_la_cedula_del_titular(datos):
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar=CEDULA,  # dato legado inconsistente (id 5642 en la BD local)
        primer_nombre='FAMILIAR',
        primer_apellido='PEREZ',
        parentesco_id=datos['hijo'].pk,
        fechanacimiento=datetime.date(2010, 1, 1),
        sexo_id=datos['sexo'].pk,
    )

    respuesta = _cliente().put(
        f'/api/v1/familiares/{familiar.pk}/',
        {'primer_nombre': 'CAMBIO', 'perfil_salud': {'grupo_sanguineo_id': datos['grupo'].pk}},
        format='json',
    )

    assert respuesta.status_code == 400
    assert MENSAJE in str(respuesta.json())


def test_validar_cambio_de_ficha_rechaza_la_cedula_del_titular(datos):
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar='12345678',
        primer_nombre='FAMILIAR',
        primer_apellido='PEREZ',
        parentesco_id=datos['hijo'].pk,
        fechanacimiento=datetime.date(2010, 1, 1),
        sexo_id=datos['sexo'].pk,
    )

    with pytest.raises(ValidationError) as error:
        LectorFichaORM().validar_familiar_cambio(
            CEDULA, str(familiar.pk), {'cedula_familiar': CEDULA},
        )

    assert error.value.campo == 'cedula_familiar'
    assert MENSAJE in str(error.value)


def test_validar_cambio_de_ficha_acepta_la_sintetica_del_titular(datos):
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar=f'{CEDULA}-1',
        primer_nombre='FAMILIAR',
        primer_apellido='PEREZ',
        parentesco_id=datos['hijo'].pk,
        fechanacimiento=datetime.date(2022, 1, 1),
        sexo_id=datos['sexo'].pk,
    )

    # No lanza: es la cédula sintética que el propio sistema generó.
    LectorFichaORM().validar_familiar_cambio(
        CEDULA, str(familiar.pk), {'cedula_familiar': f'{CEDULA}-1'},
    )


def test_acta_de_fe_de_vida_rechaza_la_cedula_del_titular(datos):
    """El validador del acta (fe de vida) usa la misma regla de familiares."""
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar='12345678',
        primer_nombre='FAMILIAR',
        primer_apellido='PEREZ',
        parentesco_id=datos['hijo'].pk,
        fechanacimiento=datetime.date(2010, 1, 1),
        sexo_id=datos['sexo'].pk,
    )
    cambio = CambioActa(
        seccion='familiares',
        accion='MODIFICAR',
        entidad_destino='familiar',
        campo='cedula_familiar',
        valor_propuesto=CEDULA,
        entidad_id=str(familiar.pk),
    )

    with pytest.raises(ValidationError) as error:
        ValidadorCambiosActaORM().validar_conjunto(CEDULA, [cambio])

    assert error.value.campo == 'cedula_familiar'
    assert MENSAJE in str(error.value)
