"""Contacto de emergencia: nombres, apellidos, teléfono y parentesco son obligatorios al crearlo."""
import pytest

from apps.autogestion.domain.services.validacion_cambios import validar_registro_nuevo, validar_valor
from core.domain.exceptions import ValidationError

_BASE = {'nombres': 'ANA', 'apellidos': 'PEREZ', 'telefono': '0412-1234567', 'relacion_id': 3}


def test_contacto_completo_es_valido():
    assert validar_registro_nuevo('contacto', 'contacto_emergencia', dict(_BASE))['relacion_id'] == 3


@pytest.mark.parametrize('campo', ['telefono', 'relacion_id'])
@pytest.mark.parametrize('vacio', [None, ''])
def test_falta_telefono_o_parentesco(campo, vacio):
    valores = {**_BASE, campo: vacio}
    with pytest.raises(ValidationError, match=campo):
        validar_registro_nuevo('contacto', 'contacto_emergencia', valores)


def test_sin_el_campo_tambien_falla():
    valores = {k: v for k, v in _BASE.items() if k != 'telefono'}
    with pytest.raises(ValidationError, match='telefono'):
        validar_registro_nuevo('contacto', 'contacto_emergencia', valores)


def test_contacto_devuelve_telefono_e164():
    assert validar_registro_nuevo('contacto', 'contacto_emergencia', dict(_BASE))['telefono'] == '+584121234567'


@pytest.mark.parametrize('campo,valor,esperado', [
    ('telefono_movil', '0414-1234567', '+584141234567'),
    ('telefono_habitacion', '0212 1234567', '+582121234567'),
    ('telefono', '+58 412 1234567', '+584121234567'),
])
def test_validar_valor_telefonos_e164(campo, valor, esperado):
    assert validar_valor(campo, valor) == esperado


def test_validar_valor_movil_exige_movil_y_rechaza_invalidos():
    with pytest.raises(ValidationError, match='móvil'):
        validar_valor('telefono_movil', '0212-1234567')
    with pytest.raises(ValidationError, match='venezolano'):
        validar_valor('telefono_habitacion', '12345')
    assert validar_valor('telefono_habitacion', '  ') is None
