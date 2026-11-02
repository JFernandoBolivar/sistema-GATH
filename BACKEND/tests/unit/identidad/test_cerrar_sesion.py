"""
Tests de `cerrar_sesion` (logout, R-11) — sin base de datos.
"""
from unittest.mock import MagicMock, patch

from apps.identidad.application.use_cases.cerrar_sesion import cerrar_sesion


def test_sin_token_no_hace_nada_y_devuelve_false():
    assert cerrar_sesion(None) is False
    assert cerrar_sesion('') is False


@patch('apps.identidad.application.use_cases.cerrar_sesion.RefreshToken')
def test_blacklistea_un_token_valido(mock_refresh_cls):
    token = MagicMock()
    mock_refresh_cls.return_value = token

    assert cerrar_sesion('refresh-valido') is True
    token.blacklist.assert_called_once()


def test_token_invalido_no_falla_el_logout():
    assert cerrar_sesion('esto-no-es-un-jwt') is False
