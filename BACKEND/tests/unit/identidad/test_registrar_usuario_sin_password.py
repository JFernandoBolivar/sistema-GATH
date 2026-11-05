"""
Tests unitarios para el alta de usuarios sin requerir contraseña (O17).
"""
from apps.identidad.infrastructure.serializers.cuenta_escritura_serializers import (
    RegistrarCuentaSerializer,
)


def test_serializer_registrar_cuenta_no_exige_password():
    datos = {
        'cedula': '12345678',
        'rol_id': 2,
    }
    ser = RegistrarCuentaSerializer(data=datos)
    assert ser.is_valid(), ser.errors
    assert ser.validated_data['cedula'] == '12345678'
    assert ser.validated_data.get('password') == ''


def test_serializer_registrar_cuenta_acepta_password_opcional_si_se_envia():
    datos = {
        'cedula': '87654321',
        'password': 'PasswordValido123*',
        'rol_id': 1,
    }
    ser = RegistrarCuentaSerializer(data=datos)
    assert ser.is_valid(), ser.errors


def test_serializer_registrar_cuenta_exige_cedula():
    datos = {
        'rol_id': 1,
    }
    ser = RegistrarCuentaSerializer(data=datos)
    assert not ser.is_valid()
    assert 'cedula' in ser.errors
