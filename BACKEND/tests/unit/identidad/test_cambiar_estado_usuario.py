"""
Tests de `cambiar_estado_usuario` con repositorio en memoria.
"""
import pytest

from apps.identidad.application.dtos.cuenta_dto import CambiarEstadoCuentaDTO
from apps.identidad.application.use_cases.cambiar_estado_usuario import (
    cambiar_estado_usuario,
)
from core.domain.exceptions import NotFoundError


def test_desactiva_explicitamente(repo_cuentas):
    cuenta = cambiar_estado_usuario(repo_cuentas, CambiarEstadoCuentaDTO(id=1, is_active=False))
    assert cuenta.is_active is False


def test_alterna_cuando_no_se_indica_estado(repo_cuentas, cuenta_activa):
    cuenta = cambiar_estado_usuario(repo_cuentas, CambiarEstadoCuentaDTO(id=1, is_active=None))
    assert cuenta.is_active is (not cuenta_activa.is_active)


def test_usuario_inexistente_falla(repo_cuentas):
    with pytest.raises(NotFoundError):
        cambiar_estado_usuario(repo_cuentas, CambiarEstadoCuentaDTO(id=999))
