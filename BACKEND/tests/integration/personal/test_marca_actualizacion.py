"""Editar el expediente, la familia o el cargo marca al trabajador como recién actualizado."""
from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def dos_empleados(db):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.create(sexo='F')
    a = EmployeeModel.objects.create(cedulaidentidad='M0000001', nombres='A', apellidos='A', sexoid=sexo)
    b = EmployeeModel.objects.create(cedulaidentidad='M0000002', nombres='B', apellidos='B', sexoid=sexo)
    viejo = timezone.now() - timedelta(days=30)
    EmployeeModel.objects.filter(pk=a.pk).update(fecha_actualizacion=viejo)
    EmployeeModel.objects.filter(pk=b.pk).update(fecha_actualizacion=viejo + timedelta(days=1))
    return a, b


def test_agregar_antecedente_lleva_al_trabajador_al_primer_lugar(dos_empleados):
    a, b = dos_empleados
    primero = EmployeeModel.objects.order_by('-fecha_actualizacion').first()
    assert primero.pk == b.pk

    AntecedenteServicioModel.objects.create(empleado=a, fecha_ingreso=date(2010, 1, 1), fecha_egreso=date(2012, 1, 1))

    primero = EmployeeModel.objects.order_by('-fecha_actualizacion').first()
    assert primero.pk == a.pk


def test_borrar_antecedente_tambien_marca(dos_empleados):
    a, b = dos_empleados
    ant = AntecedenteServicioModel.objects.create(empleado=b, fecha_ingreso=date(2010, 1, 1), fecha_egreso=date(2012, 1, 1))
    EmployeeModel.objects.filter(pk=b.pk).update(fecha_actualizacion=timezone.now() - timedelta(days=60))
    ant.delete()
    assert EmployeeModel.objects.order_by('-fecha_actualizacion').first().pk == b.pk
