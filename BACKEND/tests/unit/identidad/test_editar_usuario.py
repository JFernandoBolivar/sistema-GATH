"""
Tests de `editar_usuario` con repositorio en memoria.
"""
import pytest

from apps.identidad.application.dtos.cuenta_dto import ActualizarCuentaDTO
from apps.identidad.application.use_cases.editar_usuario import editar_usuario
from core.domain.exceptions import NotFoundError


def test_edita_departamento_y_rol(repo_cuentas):
    dto = ActualizarCuentaDTO(id=1, departamento_id=9, rol_id=1, tocar_departamento=True, tocar_rol=True)

    cuenta = editar_usuario(repo_cuentas, dto)

    assert cuenta.departamento_id == 9
    assert cuenta.rol_id == 1


def test_no_toca_campos_ausentes(repo_cuentas, cuenta_activa):
    dto = ActualizarCuentaDTO(id=1, tocar_departamento=False, tocar_rol=False)

    cuenta = editar_usuario(repo_cuentas, dto)

    assert cuenta.departamento_id == cuenta_activa.departamento_id
    assert cuenta.rol_id == cuenta_activa.rol_id


def test_cambia_password_si_se_indica(repo_cuentas):
    dto = ActualizarCuentaDTO(id=1, password='nueva-clave')

    editar_usuario(repo_cuentas, dto)

    assert repo_cuentas.verificar_password(1, 'nueva-clave')


def test_usuario_inexistente_falla(repo_cuentas):
    with pytest.raises(NotFoundError):
        editar_usuario(repo_cuentas, ActualizarCuentaDTO(id=999))
