"""Bootstrap de producción: el superadministrador queda garantizado."""
import pytest
from django.core.management.base import CommandError

from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.management.commands.preparar_produccion import (
    CEDULA_SUPERADMIN,
    Command,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def escenario():
    from apps.catalogos.infrastructure.models.catalogo_models import (
        NacionalidadModel,
        SexoModel,
    )

    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'}
    )
    sexo, _ = SexoModel.objects.get_or_create(sexo='M')
    rol, _ = RolModel.objects.get_or_create(pk=1, defaults={'nombre_rol': 'ADMINISTRADOR'})
    empleado, _ = EmployeeModel.objects.get_or_create(
        cedulaidentidad=CEDULA_SUPERADMIN,
        defaults={
            'nombres': 'JOSE FERNANDO',
            'apellidos': 'BOLIVAR HURTADO',
            'sexoid': sexo,
        },
    )
    return empleado, rol


def test_crea_la_cuenta_superadmin_si_no_existe(escenario):
    empleado, rol = escenario
    assert not CuentaModel.objects.filter(cedula_id=empleado.cedulaidentidad).exists()

    Command()._asegurar_superadmin()

    cuenta = CuentaModel.objects.get(cedula_id=empleado.cedulaidentidad)
    assert cuenta.rol_id == rol.pk
    assert cuenta.is_active is True
    assert cuenta.check_password(CEDULA_SUPERADMIN)


def test_no_cambia_la_contrasena_si_la_cuenta_ya_existe(escenario):
    empleado, rol = escenario
    cuenta = CuentaModel(cedula_id=empleado.cedulaidentidad, rol_id=3, is_active=False)
    cuenta.set_password('clave-propia')
    cuenta.save()

    Command()._asegurar_superadmin()

    cuenta.refresh_from_db()
    assert cuenta.rol_id == rol.pk
    assert cuenta.is_active is True
    assert cuenta.check_password('clave-propia')


def test_falla_si_el_empleado_no_existe(escenario):
    empleado, _ = escenario
    EmployeeModel.objects.filter(pk=empleado.pk).delete()

    with pytest.raises(CommandError, match=CEDULA_SUPERADMIN):
        Command()._asegurar_superadmin()
