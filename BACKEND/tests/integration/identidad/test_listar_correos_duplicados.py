"""Comando `listar_correos_duplicados` (RRHH): reporta repetidos entre institucional y alternativo."""
from io import StringIO

import pytest
from django.core.management import call_command

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


def _sexo() -> SexoModel:
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    return SexoModel.objects.create(sexo='F')


def _empleado(cedula: str, correo: str | None, sexo: SexoModel) -> None:
    EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='ANA', apellidos='PEREZ', sexoid=sexo, correo=correo,
    )


def _ejecutar() -> str:
    salida = StringIO()
    call_command('listar_correos_duplicados', stdout=salida)
    return salida.getvalue()


def test_reporta_repetidos_y_cruces_con_el_alternativo():
    sexo = _sexo()
    _empleado('11111111', 'rep@correo.test', sexo)
    _empleado('22222222', 'REP@correo.test', sexo)
    _empleado('33333333', 'cruce@correo.test', sexo)
    _empleado('44444444', 'unico@correo.test', sexo)
    _empleado('55555555', None, sexo)
    DatosComplementariosTrabajadorModel.objects.create(cedula='55555555', correo_alternativo='cruce@correo.test')

    texto = _ejecutar()

    assert 'Correo en colisión: rep@correo.test' in texto
    assert 'Institucional de: 11111111, 22222222' in texto
    assert 'Correo en colisión: cruce@correo.test' in texto
    assert 'Alternativo de: 55555555' in texto
    assert 'unico@correo.test' not in texto
    assert 'Total de correos con colisión: 2.' in texto
    assert 'trabajadores afectados (sin cuenta hasta corregirse): 4.' in texto


def test_sin_repetidos_reporta_cero():
    sexo = _sexo()
    _empleado('11111111', 'uno@correo.test', sexo)

    assert 'Total de correos con colisión: 0.' in _ejecutar()
