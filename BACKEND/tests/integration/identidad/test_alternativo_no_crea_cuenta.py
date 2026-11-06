"""FIX-AUD8: el correo alternativo no es login. Guardarlo no crea cuenta ni escribe `Employee.correo`."""
import pytest

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.receivers import aprovisionar_por_cedula
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import RepoCondicionTrabajadorORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CEDULA = '30000001'


@pytest.fixture
def pasivo_sin_correo(monkeypatch):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.create(sexo='F')
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='ANA', apellidos='PEREZ', sexoid=sexo, correo=None,
    )
    monkeypatch.setattr(
        RepoCondicionTrabajadorORM, 'condicion_por_cedula', lambda self, cedula: CondicionTrabajador.PASIVO,
    )


def test_guardar_alternativo_no_crea_cuenta_ni_escribe_correo_principal(pasivo_sin_correo):
    DatosComplementariosTrabajadorModel.objects.create(cedula=CEDULA, correo_alternativo='ana.alt@correo.test')

    assert not CuentaModel.objects.filter(cedula_id=CEDULA).exists()
    assert not EmployeeModel.objects.get(cedulaidentidad=CEDULA).correo


def test_aprovisionar_pasivo_con_solo_alternativo_no_crea_cuenta(pasivo_sin_correo):
    DatosComplementariosTrabajadorModel.objects.create(cedula=CEDULA, correo_alternativo='ana.alt@correo.test')

    assert aprovisionar_por_cedula(CEDULA, permitir_pasivo=True) is None
    assert not CuentaModel.objects.filter(cedula_id=CEDULA).exists()
    assert not EmployeeModel.objects.get(cedulaidentidad=CEDULA).correo
