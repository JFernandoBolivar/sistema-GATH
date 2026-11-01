"""
Tests de `editar_usuario` con repositorio en memoria (D3: sin departamento).
"""
import pytest

from apps.identidad.application.dtos.cuenta_dto import ActualizarCuentaDTO
from apps.identidad.application.use_cases.editar_usuario import editar_usuario
from core.domain.exceptions import NotFoundError


def test_edita_el_rol(repo_cuentas):
    dto = ActualizarCuentaDTO(id=1, rol_id=1, tocar_rol=True)

    cuenta = editar_usuario(repo_cuentas, dto)

    assert cuenta.rol_id == 1


def test_no_toca_campos_ausentes(repo_cuentas, cuenta_activa):
    dto = ActualizarCuentaDTO(id=1, tocar_rol=False)

    cuenta = editar_usuario(repo_cuentas, dto)

    assert cuenta.rol_id == cuenta_activa.rol_id


def test_no_cambia_la_password(repo_cuentas):
    """M2: la edición de usuario no toca la contraseña."""
    dto = ActualizarCuentaDTO(id=1, rol_id=1, tocar_rol=True)

    editar_usuario(repo_cuentas, dto)

    assert repo_cuentas.verificar_password(1, 'clave-actual')


def test_usuario_inexistente_falla(repo_cuentas):
    with pytest.raises(NotFoundError):
        editar_usuario(repo_cuentas, ActualizarCuentaDTO(id=999))
