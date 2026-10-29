"""permisos_version operativo (Etapa A4): claim en el JWT y rechazo de tokens con versión vieja."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from rest_framework_simplejwt.exceptions import InvalidToken

from apps.identidad.application.use_cases.emitir_tokens_sesion import emitir_tokens_sesion
from apps.identidad.application.use_cases.rotar_tokens_sesion import rotar_tokens_sesion
from apps.identidad.domain.entities.titular_sesion import TitularSesion
from apps.identidad.infrastructure.auth.jwt_authentication import CookieJWTAuthentication
from apps.identidad.infrastructure.models.permisos_version_model import PermisosVersionModel
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import RepoPermisosVersionORM
from core.domain.exceptions import PermissionDeniedError
from tests.unit.identidad.conftest import RepoCuentaAuthMemoria

RUTA_AUTH = 'apps.identidad.infrastructure.auth.jwt_authentication'


@patch('apps.identidad.application.use_cases.emitir_tokens_sesion.RefreshToken')
def test_emitir_embebe_el_claim_permisos_version(mock_refresh_cls):
    refresh = MagicMock()
    mock_refresh_cls.for_user.return_value = refresh
    emitir_tokens_sesion(object(), cedula='V-1', rol_nombre='ADMIN', permisos_version=4)
    refresh.__setitem__.assert_any_call('permisos_version', 4)


def _autenticar(version_token, version_actual):
    payload = {} if version_token is None else {'permisos_version': version_token}
    token = SimpleNamespace(payload=payload)
    with patch(f'{RUTA_AUTH}.JWTAuthentication.get_user', return_value=SimpleNamespace(pk=7)), \
         patch(f'{RUTA_AUTH}.RepoPermisosVersionORM') as repo:
        repo.return_value.obtener.return_value = version_actual
        return CookieJWTAuthentication().get_user(token)


def test_token_con_version_vieja_es_rechazado():
    with pytest.raises(InvalidToken):
        _autenticar(version_token=1, version_actual=2)


def test_token_con_version_vigente_es_aceptado():
    assert _autenticar(version_token=3, version_actual=3).pk == 7


def test_token_previo_a_a4_sin_claim_vale_como_version_1():
    assert _autenticar(version_token=None, version_actual=1).pk == 7
    with pytest.raises(InvalidToken):
        _autenticar(version_token=None, version_actual=2)


@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.RefreshToken')
def test_refresh_con_version_vieja_no_rota(mock_refresh_cls):
    mock_refresh_cls.return_value = MagicMock(payload={'user_id': 1, 'permisos_version': 1})
    repo = RepoCuentaAuthMemoria(titulares=[
        TitularSesion(id=1, cedula='V-1', rol_nombre='X', is_active=True, permisos_version=2)
    ])
    with pytest.raises(PermissionDeniedError):
        rotar_tokens_sesion(repo, 'refresh')


@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.emitir_tokens_sesion')
@patch('apps.identidad.application.use_cases.rotar_tokens_sesion.RefreshToken')
def test_refresh_vigente_rota_con_la_version_actual(mock_refresh_cls, mock_emitir):
    mock_refresh_cls.return_value = MagicMock(payload={'user_id': 1, 'permisos_version': 2})
    repo = RepoCuentaAuthMemoria(titulares=[
        TitularSesion(id=1, cedula='V-1', rol_nombre='X', is_active=True, permisos_version=2)
    ])
    rotar_tokens_sesion(repo, 'refresh')
    assert mock_emitir.call_args.args[-1] == 2


@pytest.mark.django_db
def test_repo_versiona_cuentas_en_tabla_propia():
    repo = RepoPermisosVersionORM()
    assert repo.obtener(501) == 1
    assert repo.incrementar_cuenta(501) == 2
    assert repo.incrementar_cuenta(501) == 3
    assert repo.obtener(501) == 3
    assert PermisosVersionModel.objects.filter(cuenta_id=501).count() == 1
