"""Nombres solo con letras y números solo con dígitos (crítica del usuario 2026-11-03)."""
import pytest

from apps.autogestion.domain.services.validacion_cambios import validar_valor
from core.domain.exceptions import ValidationError
from core.domain.validacion_personas import validar_cedula, validar_nombre, validar_telefono


@pytest.mark.parametrize('valor', ['MARÍA JOSÉ', 'Peña', "D'EMILIO", 'D’EMILIO', 'GONZÀLEZ', 'Ana  Luisa '])
def test_nombres_validos(valor):
    assert validar_nombre(valor)


@pytest.mark.parametrize('valor', ['Ana2', '123', 'Ana_Luisa', 'Ana@', '<script>', 'JOSE A.'])
def test_nombres_invalidos_al_crear(valor):
    with pytest.raises(ValueError):
        validar_nombre(valor)


def test_al_editar_se_tolera_la_inicial_con_punto_del_legado():
    assert validar_nombre('JOSE A.', edicion=True) == 'JOSE A.'
    with pytest.raises(ValueError):
        validar_nombre('JOSE 2', edicion=True)


def test_normaliza_espacios():
    assert validar_nombre('  Ana   Luisa ') == 'Ana Luisa'


@pytest.mark.parametrize('valor,ok', [('12345678', True), ('1234', False), ('12345678901', False), ('V1234567', False), ('', True)])
def test_cedula(valor, ok):
    if ok:
        validar_cedula(valor)
    else:
        with pytest.raises(ValueError):
            validar_cedula(valor)


@pytest.mark.parametrize('valor,ok', [('04141234567', True), ('0414-123.4567', False), ('0414-1234567', True), ('(0212) 555 1234', True), ('0414abc4567', False), ('123', False)])
def test_telefono(valor, ok):
    if ok:
        validar_telefono(valor)
    else:
        with pytest.raises(ValueError):
            validar_telefono(valor)


def test_autogestion_rechaza_numeros_en_nombres_de_familiar():
    with pytest.raises(ValidationError):
        validar_valor('primer_nombre', 'Ana2')
    assert validar_valor('primer_apellido', 'Pérez') == 'Pérez'
