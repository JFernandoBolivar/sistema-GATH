"""Serial del Carnet de la Patria: se guarda, se devuelve y se valida."""
import importlib
from pathlib import Path

import pytest

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.pasivos.presentation.serializers.pasivos_serializers import (
    PasivoActualizarInputSerializer,
    PasivoCrearInputSerializer,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
    EmpleadoActualizarSerializer,
    EmpleadoCrearSerializer,
)
from core.domain.validacion_personas import validar_serial_carnet_patria

MENSAJE = "El serial del Carnet de la Patria solo admite letras y números (máximo 30)"


@pytest.mark.django_db
def test_alta_y_actualizacion_guardan_y_devuelven_el_serial():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={"codigo": "V", "nombre": "Venezolana"})
    sexo = SexoModel.objects.create(sexo="M")
    repo = RepoPersonalORM()

    creado = repo.crear_empleado({
        "cedula": "99001234", "nombres": "ANA", "apellidos": "PEREZ", "sexo_id": sexo.pk,
        "carnet_patria": "123456", "carnet_patria_serial": "A1B2C3",
    })
    assert creado.carnet_patria == "123456"
    assert creado.carnet_patria_serial == "A1B2C3"
    assert EmployeeModel.objects.get(cedulaidentidad="99001234").carnet_patria_serial == "A1B2C3"

    actualizado = repo.actualizar_empleado("99001234", {"carnet_patria_serial": "ZZ99"})
    assert actualizado.carnet_patria_serial == "ZZ99"
    assert actualizado.carnet_patria == "123456"


@pytest.mark.parametrize("valor", ["AB 12", "AB-12", "ñandú", "A" * 31])
def test_validacion_rechaza_caracteres_invalidos(valor):
    with pytest.raises(ValueError, match="solo admite letras y números"):
        validar_serial_carnet_patria(valor)


@pytest.mark.parametrize("valor,esperado", [("", ""), (None, None), ("A1b2", "A1b2"), (" X9 ", "X9")])
def test_validacion_acepta_vacio_y_alfanumerico(valor, esperado):
    assert validar_serial_carnet_patria(valor) == esperado


@pytest.mark.parametrize("serializer", [
    EmpleadoCrearSerializer, EmpleadoActualizarSerializer,
    PasivoCrearInputSerializer, PasivoActualizarInputSerializer,
])
def test_serializers_de_escritura_validan_el_serial(serializer):
    campo = serializer().fields["carnet_patria_serial"]
    assert campo.required is False
    ser = serializer()
    from rest_framework.exceptions import ValidationError
    with pytest.raises(ValidationError) as exc:
        ser.validate_carnet_patria_serial("AB 12")
    assert MENSAJE in str(exc.value)
    assert ser.validate_carnet_patria_serial("AB12") == "AB12"


def test_existe_la_migracion_de_la_columna():
    modulo = importlib.import_module("core.migrations.0009_serial_carnet_patria")
    sql = modulo.SQL_AGREGAR
    assert "carnet_patria_serial" in sql and "IF NOT EXISTS" in sql
    assert "DROP COLUMN IF EXISTS" in modulo.SQL_QUITAR
    assert Path(modulo.__file__).exists()
