"""
Tests de `emitir_tokens_sesion` (R-11) — sin base de datos.

Hallazgo verificado durante esta tarea: `RefreshToken.for_user()` de
`simplejwt`, con `rest_framework_simplejwt.token_blacklist` instalado (como
está en GATH), **siempre** crea una fila `OutstandingToken` — toca la base de
datos y exige que el objeto recibido sea una instancia real de
`AUTH_USER_MODEL` (la FK `OutstandingToken.user` lo exige). Esto es cierto
también para el código legado (`USER/services/token_service.py`) y para el
`LoginView` que ya existía antes de esta tarea: emitir un token JWT en GATH
**siempre** implica una escritura en BD, no es opcional, y siempre requiere
la instancia real del titular (no basta un objeto liviano con solo `.id`).

Por eso este test no ejercita `RefreshToken` real (eso pertenece a un test de
integración con `@pytest.mark.django_db`, fuera de alcance aquí — ver
la skill de testing): se mockea en el punto de entrada del caso de uso,
verificando la única regla de negocio propia de `emitir_tokens_sesion` — que
los claims `cedula`/`rol` se embeben en el token emitido por la librería.
"""
from unittest.mock import MagicMock, patch

from apps.identidad.application.use_cases.emitir_tokens_sesion import (
    emitir_tokens_sesion,
)


@patch('apps.identidad.application.use_cases.emitir_tokens_sesion.RefreshToken')
def test_emite_tokens_embebiendo_claims_cedula_y_rol(mock_refresh_cls):
    titular_orm = object()  # opaco: solo se reenvía a RefreshToken.for_user()
    refresh_falso = MagicMock()
    refresh_falso.access_token = 'access-fake'
    refresh_falso.__str__.return_value = 'refresh-fake'
    mock_refresh_cls.for_user.return_value = refresh_falso

    tokens = emitir_tokens_sesion(titular_orm, cedula='V-11111111', rol_nombre='ADMINISTRADOR')

    mock_refresh_cls.for_user.assert_called_once_with(titular_orm)
    refresh_falso.__setitem__.assert_any_call('cedula', 'V-11111111')
    refresh_falso.__setitem__.assert_any_call('rol', 'ADMINISTRADOR')
    assert tokens.access == 'access-fake'
    assert tokens.refresh == 'refresh-fake'


@patch('apps.identidad.application.use_cases.emitir_tokens_sesion.RefreshToken')
def test_rol_ausente_embebe_claim_rol_en_none(mock_refresh_cls):
    refresh_falso = MagicMock()
    mock_refresh_cls.for_user.return_value = refresh_falso

    emitir_tokens_sesion(object(), cedula='V-22222222', rol_nombre=None)

    refresh_falso.__setitem__.assert_any_call('rol', None)
