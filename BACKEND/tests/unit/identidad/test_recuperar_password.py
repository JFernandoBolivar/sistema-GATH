"""
Tests unitarios del flujo de recuperación y restablecimiento de contraseña (C-2, S4, S5).
"""
from unittest.mock import MagicMock, patch

import pytest
from core.domain.exceptions import ValidationError
from apps.identidad.infrastructure.tokens.password_reset_token import (
    generar_token_recuperacion,
    validar_token_recuperacion,
)
from apps.identidad.application.use_cases.solicitar_recuperacion_password import (
    solicitar_recuperacion_password,
    MENSAJE_RESPUESTA_GENERICO,
)
from apps.identidad.application.use_cases.restablecer_password import (
    restablecer_password,
)


def test_generar_y_validar_token_recuperacion():
    cuenta_id = 42
    cedula = "V-12345678"
    pwhash = "pbkdf2_sha256$260000$abc123xyz456"

    token = generar_token_recuperacion(cuenta_id, cedula, pwhash)
    assert isinstance(token, str)
    assert len(token) > 20

    res_id, res_cedula, res_hash = validar_token_recuperacion(token, max_age=900)
    assert res_id == cuenta_id
    assert res_cedula == cedula
    assert res_hash == pwhash[:16]


def test_token_expirado_lanza_validation_error():
    cuenta_id = 10
    cedula = "V-99999999"
    pwhash = "hash_actual_12345"

    token = generar_token_recuperacion(cuenta_id, cedula, pwhash)
    with pytest.raises(ValidationError) as exc:
        validar_token_recuperacion(token, max_age=-1)
    assert "ha expirado" in str(exc.value)


def test_token_corrupto_o_invalido_lanza_validation_error():
    with pytest.raises(ValidationError) as exc:
        validar_token_recuperacion("token_invalido_firmado_mal")
    assert "inválido" in str(exc.value)

    with pytest.raises(ValidationError):
        validar_token_recuperacion("")


@patch("apps.identidad.application.use_cases.solicitar_recuperacion_password.CuentaModel")
def test_solicitar_recuperacion_con_usuario_existente_envia_correo(mock_cuenta_model):
    mock_cuenta = MagicMock()
    mock_cuenta.pk = 1
    mock_cuenta.cedula_id = "V-11111111"
    mock_cuenta.password = "pbkdf2_sha256$12345"
    mock_cuenta.cedula.correo = "empleado@conatel.gob.ve"
    mock_cuenta.cedula.nombres = "Juan"
    mock_cuenta.cedula.apellidos = "Pérez"

    # Encadenar select_related("cedula").filter(is_active=True).filter(...).first()
    mock_cuenta_model.objects.select_related.return_value.filter.return_value.filter.return_value.first.return_value = mock_cuenta

    mock_email_fn = MagicMock()
    mock_token_fn = MagicMock(return_value="token-mock-123")

    resultado = solicitar_recuperacion_password(
        identificador="empleado@conatel.gob.ve",
        enviar_email_fn=mock_email_fn,
        generar_token_fn=mock_token_fn,
    )

    assert resultado == MENSAJE_RESPUESTA_GENERICO
    mock_token_fn.assert_called_once_with(1, "V-11111111", "pbkdf2_sha256$12345")
    mock_email_fn.assert_called_once()
    dest, nombre, enlace = mock_email_fn.call_args[0]
    assert dest == "empleado@conatel.gob.ve"
    assert "Juan Pérez" in nombre
    assert "token=token-mock-123" in enlace


@patch("apps.identidad.application.use_cases.solicitar_recuperacion_password.CuentaModel")
def test_solicitar_recuperacion_usuario_inexistente_no_envia_correo_y_retorna_generico(mock_cuenta_model):
    mock_cuenta_model.objects.select_related.return_value.filter.return_value.filter.return_value.first.return_value = None

    mock_email_fn = MagicMock()

    resultado = solicitar_recuperacion_password(
        identificador="noexiste@conatel.gob.ve",
        enviar_email_fn=mock_email_fn,
    )

    assert resultado == MENSAJE_RESPUESTA_GENERICO
    mock_email_fn.assert_not_called()


def test_solicitar_recuperacion_identificador_vacio_lanza_validation_error():
    with pytest.raises(ValidationError) as exc:
        solicitar_recuperacion_password("")
    assert "correo institucional o cédula" in str(exc.value)


@patch("apps.identidad.application.use_cases.restablecer_password.CuentaModel")
def test_restablecer_password_exitoso(mock_cuenta_model):
    mock_cuenta = MagicMock()
    mock_cuenta.pk = 1
    mock_cuenta.cedula_id = "V-12345678"
    mock_cuenta.password = "hash_antiguo_1234567890"
    mock_cuenta.is_active = True
    mock_cuenta.permisos_version = 2

    mock_cuenta_model.objects.select_related.return_value.filter.return_value.first.return_value = mock_cuenta

    mock_validar_token = MagicMock(return_value=(1, "V-12345678", "hash_antiguo_123"))
    mock_validar_fortaleza = MagicMock()

    resultado = restablecer_password(
        token="token-valido",
        password_nuevo="Conatel2026!Nueva",
        password_confirmacion="Conatel2026!Nueva",
        validar_token_fn=mock_validar_token,
        validar_fortaleza_fn=mock_validar_fortaleza,
    )

    assert "exitosamente" in resultado
    mock_validar_fortaleza.assert_called_once_with("Conatel2026!Nueva")
    mock_cuenta.set_password.assert_called_once_with("Conatel2026!Nueva")
    assert mock_cuenta.permisos_version == 3
    mock_cuenta.save.assert_called_once_with(update_fields=["password", "permisos_version"])


def test_restablecer_password_falla_si_confirmacion_difiere():
    with pytest.raises(ValidationError) as exc:
        restablecer_password(
            token="token-cualquiera",
            password_nuevo="Password123!",
            password_confirmacion="PasswordDiferente!",
        )
    assert "no coinciden" in str(exc.value)


@patch("apps.identidad.application.use_cases.restablecer_password.CuentaModel")
def test_restablecer_password_rechaza_token_si_password_ya_fue_cambiado_previamente(mock_cuenta_model):
    mock_cuenta = MagicMock()
    mock_cuenta.pk = 1
    mock_cuenta.cedula_id = "V-12345678"
    mock_cuenta.password = "NUEVO_HASH_CAMBIADO"
    mock_cuenta.is_active = True

    mock_cuenta_model.objects.select_related.return_value.filter.return_value.first.return_value = mock_cuenta

    mock_validar_token = MagicMock(return_value=(1, "V-12345678", "HASH_ANTERIOR_VIEJO"))

    with pytest.raises(ValidationError) as exc:
        restablecer_password(
            token="token-con-hash-antiguo",
            password_nuevo="PasswordValido123!",
            password_confirmacion="PasswordValido123!",
            validar_token_fn=mock_validar_token,
        )
    assert "ya ha sido utilizado" in str(exc.value)


@patch("apps.identidad.application.use_cases.solicitar_recuperacion_password.solicitar_recuperacion_password")
def test_vista_solicitar_recuperacion_api(mock_solicitar_uc):
    from rest_framework.test import APIRequestFactory
    from apps.identidad.presentation.views.auth_views import SolicitarRecuperacionPasswordView

    mock_solicitar_uc.return_value = "Mensaje de confirmación"
    factory = APIRequestFactory()
    view = SolicitarRecuperacionPasswordView.as_view()

    request = factory.post("/api/v1/identidad/auth/solicitar-recuperacion/", {"identificador": "usuario@conatel.gob.ve"}, format="json")
    response = view(request)

    assert response.status_code == 200
    assert response.data["status"] == "success"
    assert response.data["message"] == "Mensaje de confirmación"


@patch("apps.identidad.application.use_cases.restablecer_password.restablecer_password")
def test_vista_restablecer_password_api(mock_restablecer_uc):
    from rest_framework.test import APIRequestFactory
    from apps.identidad.presentation.views.auth_views import RestablecerPasswordView

    mock_restablecer_uc.return_value = "Contraseña restablecida correctamente."
    factory = APIRequestFactory()
    view = RestablecerPasswordView.as_view()

    payload = {
        "token": "token-test-xyz",
        "password_nuevo": "NuevaClave2026!",
        "password_confirmacion": "NuevaClave2026!",
    }
    request = factory.post("/api/v1/identidad/auth/restablecer-password/", payload, format="json")
    response = view(request)

    assert response.status_code == 200
    assert response.data["status"] == "success"
    assert response.data["message"] == "Contraseña restablecida correctamente."
