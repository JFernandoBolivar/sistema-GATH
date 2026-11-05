"""Longitudes y formatos del expediente (QA 2026-11-04) y correo alternativo de «Actualizar Información Básica»."""
import pytest

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.familiares.presentation.serializers.familiares_serializers import RegistrarFamiliarInputSerializer
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
    EmpleadoActualizarSerializer,
    EmpleadoCrearSerializer,
)
from apps.personal.presentation.serializers.personal_serializers import EmpleadoSerializer
from core.domain.exceptions import ValidationError


def _errores(serializer_cls, campo, valor, **kwargs):
    """Valida un campo suelto con el validate_<campo> del serializer; devuelve el mensaje o None."""
    from rest_framework import serializers as drf

    ser = serializer_cls(**kwargs)
    try:
        getattr(ser, f"validate_{campo}")(valor)
    except drf.ValidationError as exc:
        return str(exc.detail[0])
    return None


@pytest.mark.parametrize("valor", ["1234", "1234567890", "30900439999999999999", "12a45678", "12.345.678"])
def test_cedula_del_alta_rechaza_longitud_y_formato_invalidos(valor):
    assert _errores(EmpleadoCrearSerializer, "cedula", valor) is not None


@pytest.mark.parametrize("valor", ["12345", "123456", "12345678", "123456789"])
def test_cedula_del_alta_acepta_5_a_9_digitos(valor):
    assert _errores(EmpleadoCrearSerializer, "cedula", valor) is None


@pytest.mark.parametrize("valor", ["A", "Juan3", "Ana_", "X" * 61])
def test_nombres_del_alta_rechazan_longitud_y_simbolos(valor):
    assert _errores(EmpleadoCrearSerializer, "nombres", valor) is not None
    assert _errores(EmpleadoCrearSerializer, "apellidos", valor) is not None


def test_nombres_del_alta_se_normalizan_a_mayusculas():
    ser = EmpleadoCrearSerializer()
    assert ser.validate_nombres("María José") == "MARÍA JOSÉ"
    assert ser.validate_apellidos("D'Emilio") == "D'EMILIO"


def test_edicion_tolera_el_punto_de_las_iniciales_del_legado():
    assert EmpleadoActualizarSerializer().validate_nombres("Jose A.") == "JOSE A."
    assert _errores(EmpleadoCrearSerializer, "nombres", "Jose A.") is not None


@pytest.mark.parametrize("valor", ["12345", "123456789012", "ABCDEFGHIJ", "1234-56789"])
def test_codigo_del_carnet_exige_10_digitos(valor):
    assert _errores(EmpleadoCrearSerializer, "carnet_patria", valor) is not None


def test_codigo_del_carnet_acepta_10_digitos_y_separadores_del_legado():
    ser = EmpleadoCrearSerializer()
    assert ser.validate_carnet_patria("1234567890") == "1234567890"
    assert ser.validate_carnet_patria("000-0000000-0") == "0000000000"
    assert ser.validate_carnet_patria("") == ""


def test_correo_y_correo_alternativo_limitan_a_254():
    for campo in ("correo", "correo_alternativo"):
        assert EmpleadoCrearSerializer().fields[campo].max_length == 254


def test_correo_alternativo_valida_formato():
    ser = EmpleadoActualizarSerializer(data={"correo_alternativo": "no-es-correo"}, partial=True)
    assert not ser.is_valid()
    assert "correo_alternativo" in ser.errors
    ok = EmpleadoActualizarSerializer(data={"correo_alternativo": "otro@gmail.com"}, partial=True)
    assert ok.is_valid(), ok.errors
    vacio = EmpleadoActualizarSerializer(data={"correo_alternativo": ""}, partial=True)
    assert vacio.is_valid(), vacio.errors


def test_direccion_exacta_limita_longitud():
    from apps.personal.infrastructure.serializers.empleado_escritura_serializers import DatosViviendaEscrituraSerializer

    assert DatosViviendaEscrituraSerializer().fields["direccion_exacta"].max_length == 300


def test_contacto_de_emergencia_valida_nombres():
    from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
        ContactoEmergenciaEscrituraSerializer,
    )

    assert _errores(ContactoEmergenciaEscrituraSerializer, "nombres", "M") is not None
    assert _errores(ContactoEmergenciaEscrituraSerializer, "apellidos", "L" * 61) is not None
    assert _errores(ContactoEmergenciaEscrituraSerializer, "nombres", "María") is None


@pytest.mark.parametrize("valor", ["1234567890", "30900439999999999999"])
def test_cedula_del_familiar_exige_5_a_9_digitos(valor):
    assert _errores(RegistrarFamiliarInputSerializer, "cedula_familiar", valor) is not None


def test_cedula_del_familiar_acepta_5_digitos():
    assert _errores(RegistrarFamiliarInputSerializer, "cedula_familiar", "12345") is None


def test_nombres_del_familiar_limitan_a_60():
    assert _errores(RegistrarFamiliarInputSerializer, "primer_nombre", "A" * 61) is not None
    assert _errores(RegistrarFamiliarInputSerializer, "primer_nombre", "Ana") is None


@pytest.mark.django_db
def test_correo_alternativo_se_guarda_y_se_lee_en_el_detalle():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={"codigo": "V", "nombre": "Venezolana"})
    sexo = SexoModel.objects.create(sexo="M")
    repo = RepoPersonalORM()
    repo.crear_empleado({
        "cedula": "99002345", "nombres": "ANA", "apellidos": "PEREZ", "sexo_id": sexo.pk,
        "correo": "ana@conatel.gob.ve",
    })
    assert repo.obtener_por_cedula("99002345").correo_alternativo is None

    actualizado = repo.actualizar_empleado("99002345", {"correo_alternativo": "ana@gmail.com"})
    assert actualizado.correo_alternativo == "ana@gmail.com"
    assert DatosComplementariosTrabajadorModel.objects.get(cedula="99002345").correo_alternativo == "ana@gmail.com"

    # Se devuelve por el endpoint de personal sin romper el contrato existente.
    from apps.personal.application.use_cases.listar_personal import _empleado_a_dto

    datos = EmpleadoSerializer(_empleado_a_dto(actualizado)).data
    assert datos["correo_alternativo"] == "ana@gmail.com"
    assert datos["correo"] == "ana@conatel.gob.ve"

    # Vaciarlo lo borra; no escribirlo lo deja intacto.
    repo.actualizar_empleado("99002345", {"nombres": "ANA MARIA"})
    assert repo.obtener_por_cedula("99002345").correo_alternativo == "ana@gmail.com"
    assert repo.actualizar_empleado("99002345", {"correo_alternativo": ""}).correo_alternativo is None


@pytest.mark.django_db
def test_cedula_y_correo_duplicados_senalan_el_campo():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={"codigo": "V", "nombre": "Venezolana"})
    sexo = SexoModel.objects.create(sexo="M")
    repo = RepoPersonalORM()
    base = {"nombres": "ANA", "apellidos": "PEREZ", "sexo_id": sexo.pk}
    repo.crear_empleado({**base, "cedula": "99003456", "correo": "dup@conatel.gob.ve"})

    with pytest.raises(ValidationError) as cedula:
        repo.crear_empleado({**base, "cedula": "99003456"})
    assert cedula.value.campo == "cedula"

    with pytest.raises(ValidationError) as correo:
        repo.crear_empleado({**base, "cedula": "99003457", "correo": "DUP@conatel.gob.ve"})
    assert correo.value.campo == "correo"

    repo.crear_empleado({**base, "cedula": "99003458", "correo": "otro@conatel.gob.ve"})
    with pytest.raises(ValidationError) as edicion:
        repo.actualizar_empleado("99003458", {"correo": "dup@conatel.gob.ve"})
    assert edicion.value.campo == "correo"
