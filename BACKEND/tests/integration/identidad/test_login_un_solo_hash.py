"""L-LOGIN: el login hace un solo `check_password` (Argon2) por intento."""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

URL = '/api/v1/identidad/auth/login/'
CEDULA = '99000666'
CORREO = 'login.cache@conatel.gob.ve'


@pytest.fixture
def cuenta():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'}
    )
    sexo = SexoModel.objects.create(sexo='M')
    rol, _ = RolModel.objects.get_or_create(
        pk=3, defaults={'nombre_rol': 'AUTOGESTION'}
    )
    empleado = EmployeeModel.objects.create(
        cedulaidentidad=CEDULA,
        nombres='LOGIN',
        apellidos='CACHE',
        correo=CORREO,
        sexoid=sexo,
        nacionalidad_id=1,
    )
    fila = CuentaModel(cedula_id=empleado.cedulaidentidad, rol=rol, is_active=True)
    fila.set_password(CEDULA)
    fila.save()
    return fila


def test_login_hace_un_solo_check_password(cuenta, monkeypatch):
    original = CuentaModel.check_password
    llamadas = []

    def contar(self, raw_password):
        llamadas.append(raw_password)
        return original(self, raw_password)

    monkeypatch.setattr(CuentaModel, 'check_password', contar)

    def prohibido(*args, **kwargs):
        raise AssertionError('El login no debe volver a hashear la contraseña.')

    monkeypatch.setattr(RepoCuentasORM, 'verificar_password', prohibido)

    respuesta = APIClient().post(
        URL, {'correo': CORREO, 'password': CEDULA}, format='json'
    )

    assert respuesta.status_code == 200, respuesta.content
    assert len(llamadas) == 1
