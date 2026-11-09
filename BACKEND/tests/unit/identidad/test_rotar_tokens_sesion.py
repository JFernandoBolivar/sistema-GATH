"""
Tests de `rotar_tokens_sesion` (R-11, corrige ALTA-08) — sin base de datos.

`RefreshToken` se mockea en el punto de entrada del caso de uso (patrón de
mocking de integraciones externas de la skill de testing): construir un
`RefreshToken` real dispara `check_blacklist()` contra la BD por heredar
`BlacklistMixin`, y aquí solo interesa probar la regla de negocio (revalidar
`is_active` y preservar claims), no la librería.
"""
from unittest.mock import MagicMock, patch

import pytest

from apps.identidad.application.use_cases.rotar_tokens_sesion import (
    rotar_tokens_sesion,
)
from apps.identidad.domain.entities.titular_sesion import TitularSesion
from core.domain.exceptions import PermissionDeniedError, ValidationError
from tests.unit.identidad.conftest import RepoCuentaAuthMemoria


def _token_falso(payload):
    token = MagicMock()
    token.payload = payload
    return token


@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.emitir_tokens_sesion')
@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.RefreshToken')
def test_rota_tokens_para_titular_activo_y_blacklistea_el_anterior(
    mock_refresh_cls, mock_emitir
):
    token_anterior = _token_falso({'user_id': 1})
    mock_refresh_cls.return_value = token_anterior
    mock_emitir.return_value = 'TOKENS-NUEVOS'
    repo = RepoCuentaAuthMemoria(
        titulares=[TitularSesion(id=1, cedula='V-1', rol_nombre='ADMIN', is_active=True)]
    )

    resultado = rotar_tokens_sesion(repo, 'refresh-valido')

    assert resultado == 'TOKENS-NUEVOS'
    token_anterior.blacklist.assert_called_once()


@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.RefreshToken')
def test_rechaza_titular_desactivado(mock_refresh_cls):
    mock_refresh_cls.return_value = _token_falso({'user_id': 1})
    repo = RepoCuentaAuthMemoria(
        titulares=[TitularSesion(id=1, cedula='V-1', rol_nombre='ADMIN', is_active=False)]
    )

    with pytest.raises(PermissionDeniedError):
        rotar_tokens_sesion(repo, 'refresh-valido')


@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.RefreshToken')
def test_rechaza_titular_inexistente(mock_refresh_cls):
    mock_refresh_cls.return_value = _token_falso({'user_id': 999})

    with pytest.raises(PermissionDeniedError):
        rotar_tokens_sesion(RepoCuentaAuthMemoria(), 'refresh-valido')


def test_token_con_formato_invalido_lanza_validation_error():
    with pytest.raises(ValidationError):
        rotar_tokens_sesion(RepoCuentaAuthMemoria(), 'esto-no-es-un-jwt')
