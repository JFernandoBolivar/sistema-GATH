"""Login sin enumeración por tiempo: con una cuenta inexistente también se verifica un hash real."""
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.identidad.presentation.views import auth_views


def test_hash_ficticio_es_un_hash_real():
    auth_views._HASH_FICTICIO = None
    auth_views._verificar_clave_ficticia('cualquiera')
    # make_password(None) daría un hash inutilizable ('!…') que check_password descarta sin calcular nada.
    assert auth_views._HASH_FICTICIO.startswith('argon2$')


@pytest.mark.django_db
def test_login_con_correo_inexistente_verifica_un_hash():
    with patch.object(auth_views, '_verificar_clave_ficticia', wraps=auth_views._verificar_clave_ficticia) as espia:
        respuesta = APIClient().post(
            '/api/v1/identidad/auth/login/',
            {'correo': 'no.existe.tiempo@auditoria.local', 'password': 'x'},
            format='json',
        )
    assert respuesta.status_code == 401
    espia.assert_called_once_with('x')
