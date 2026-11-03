"""Los serializers de escritura de familiares y pasivos rechazan números en nombres y letras en cédulas."""
import pytest
from rest_framework import serializers

from apps.familiares.presentation.serializers.familiares_serializers import RegistrarFamiliarInputSerializer
from apps.pasivos.presentation.serializers.pasivos_serializers import (
    PasivoActualizarInputSerializer,
    PasivoCrearInputSerializer,
)


def _familiar(partial=False):
    return RegistrarFamiliarInputSerializer(data={}, partial=partial)


def test_familiar_nombre_con_numeros_rechazado():
    with pytest.raises(serializers.ValidationError):
        _familiar().validate_primer_nombre('Ana2')
    assert _familiar().validate_primer_apellido("D'EMILIO") == "D'EMILIO"


def test_familiar_cedula_solo_digitos():
    with pytest.raises(serializers.ValidationError):
        _familiar().validate_cedula_familiar('12A45678')
    assert _familiar().validate_cedula_familiar('12345678') == '12345678'
    # En edición se conserva la cédula sintética del legado.
    assert _familiar(partial=True).validate_cedula_familiar('12345678-1') == '12345678-1'


def test_familiar_parentesco_es_obligatorio():
    assert RegistrarFamiliarInputSerializer().fields['parentesco_id'].required is True


def test_alta_de_pasivo_valida_nombres_cedula_y_telefono():
    s = PasivoCrearInputSerializer(data={
        'cedula': '12A', 'nombres': 'JUAN 2', 'apellidos': 'PEREZ', 'sexo_id': 1,
        'fecha_nacimiento': '1950-01-01', 'tipo_nomina_id': 1, 'telefono_movil': '0414ABC1234',
    })
    assert not s.is_valid()
    assert {'cedula', 'nombres', 'telefono_movil'} <= set(s.errors)


def test_edicion_de_pasivo_tolera_inicial_y_rechaza_numeros():
    assert PasivoActualizarInputSerializer(data={'nombres': 'JOSE A.'}).is_valid()
    s = PasivoActualizarInputSerializer(data={'apellidos': 'PEREZ 3'})
    assert not s.is_valid() and 'apellidos' in s.errors
