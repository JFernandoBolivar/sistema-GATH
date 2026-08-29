"""
Tests de `registrar_usuario` (CRIT-05) con repositorio en memoria.
"""
import pytest

from apps.identidad.application.dtos.cuenta_dto import RegistrarCuentaDTO
from apps.identidad.application.use_cases.registrar_usuario import registrar_usuario
from core.domain.exceptions import ConflictError, NotFoundError


def test_registra_una_cuenta_nueva(repo_cuentas):
    dto = RegistrarCuentaDTO(cedula='V-22222222', password='clave-1', departamento_id=3, rol_id=8)

    cuenta = registrar_usuario(repo_cuentas, dto)

    assert cuenta.cedula == 'V-22222222'
    assert cuenta.departamento_id == 3
    assert cuenta.rol_id == 8
    assert repo_cuentas.verificar_password(cuenta.id, 'clave-1')


def test_rechaza_cedula_que_ya_tiene_cuenta(repo_cuentas):
    dto = RegistrarCuentaDTO(cedula='V-11111111', password='x')

    with pytest.raises(ConflictError):
        registrar_usuario(repo_cuentas, dto)


def test_rechaza_cedula_sin_empleado_asociado(repo_cuentas):
    dto = RegistrarCuentaDTO(cedula='V-99999999', password='x')

    with pytest.raises(NotFoundError):
        registrar_usuario(repo_cuentas, dto)
