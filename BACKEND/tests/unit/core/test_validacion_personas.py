"""Nombres solo con letras y números solo con dígitos (crítica del usuario 2026-11-03)."""
import pytest

from apps.autogestion.domain.services.validacion_cambios import validar_valor
from core.domain.exceptions import ValidationError
from core.domain.validacion_personas import formatear_telefono, validar_cedula, validar_nombre, validar_telefono


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


@pytest.mark.parametrize('valor,esperado', [
    ('0412-1234567', '+584121234567'), ('4121234567', '+584121234567'), ('04121234567', '+584121234567'),
    ('+58 412 1234567', '+584121234567'), ('(0412) 123.4567', '+584121234567'), ('584121234567', '+584121234567'),
    ('0212 1234567', '+582121234567'), ('2121234567', '+582121234567'),
    ('+1 650 253 0000', '+16502530000'), ('  ', None), ('', None), (None, None),
])
def test_telefono_normaliza_a_e164(valor, esperado):
    assert validar_telefono(valor) == esperado


@pytest.mark.parametrize('valor', ['04121234', '0412-12345678901', '123', '0999-1234567'])
def test_telefono_venezolano_invalido(valor):
    with pytest.raises(ValueError, match='Número venezolano inválido'):
        validar_telefono(valor)


def test_telefono_otro_pais_invalido():
    with pytest.raises(ValueError, match=r'Número inválido para el país \(\+1\)\. Revise la cantidad de dígitos\.'):
        validar_telefono('+1 650 253')


@pytest.mark.parametrize('valor', ['nan', '0414abc4567', '04.14-12a'])
def test_telefono_basura(valor):
    with pytest.raises(ValueError, match='solo admite números'):
        validar_telefono(valor)


def test_telefono_movil_exigido():
    assert validar_telefono('0414-1234567', tipo='movil') == '+584141234567'
    with pytest.raises(ValueError, match='Debe ser un número móvil'):
        validar_telefono('0212-1234567', tipo='movil')
    assert validar_telefono('0212-1234567', tipo='cualquiera') == '+582121234567'


def test_telefono_etiqueta_en_mensaje():
    with pytest.raises(ValueError, match='^El móvil solo admite'):
        validar_telefono('abc', etiqueta='El móvil')


def test_formatear_telefono():
    assert formatear_telefono('+584121234567') == '+58 412 1234567'
    assert formatear_telefono('04121234567') == '+58 412 1234567'
    assert formatear_telefono('nan') == 'nan'
    assert formatear_telefono('123') == '123'
    assert formatear_telefono(None) == ''
    assert formatear_telefono('  ') == ''


def test_autogestion_rechaza_numeros_en_nombres_de_familiar():
    with pytest.raises(ValidationError):
        validar_valor('primer_nombre', 'Ana2')
    assert validar_valor('primer_apellido', 'Pérez') == 'Pérez'
