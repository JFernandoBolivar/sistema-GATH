"""
Tests unitarios del flujo de recuperación y restablecimiento de contraseña (C-2, S4, S5).
"""
from unittest.mock import MagicMock, patch

import pytest
from apps.identidad.domain.entities.cuenta_recuperacion import CuentaRecuperacion
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


class RepoRecuperacionMemoria:
    """Doble en memoria del puerto `RepoRecuperacionPassword`."""

    def __init__(self, cuenta=None):
        self.cuenta = cuenta
        self.restablecidas = []

    def buscar_activa_por_identificador(self, identificador):
        return self.cuenta

    def obtener_por_id(self, cuenta_id):
        return self.cuenta

    def restablecer_password(self, cuenta_id, password_nuevo):
        self.restablecidas.append((cuenta_id, password_nuevo))


def _cuenta(**kw):
    datos = dict(
        id=1, cedula="V-11111111", correo="empleado@conatel.gob.ve",
        nombre_completo="Juan Pérez", password_hash="pbkdf2_sha256$12345", activa=True,
    )
    datos.update(kw)
    return CuentaRecuperacion(**datos)


def test_solicitar_recuperacion_con_usuario_existente_envia_correo():
    mock_email_fn = MagicMock()
    mock_token_fn = MagicMock(return_value="token-mock-123")

    resultado = solicitar_recuperacion_password(
        RepoRecuperacionMemoria(_cuenta()),
        identificador="empleado@conatel.gob.ve",
        base_frontend="http://localhost:3001/",
        enviar_email_fn=mock_email_fn,
        generar_token_fn=mock_token_fn,
    )

    assert resultado == MENSAJE_RESPUESTA_GENERICO
    mock_token_fn.assert_called_once_with(1, "V-11111111", "pbkdf2_sha256$12345")
    dest, nombre, enlace = mock_email_fn.call_args[0]
    assert dest == "empleado@conatel.gob.ve"
    assert "Juan Pérez" in nombre
    assert enlace == "http://localhost:3001/restablecer-password?token=token-mock-123"


def test_solicitar_recuperacion_usuario_inexistente_no_envia_correo_y_retorna_generico():
    mock_email_fn = MagicMock()

    resultado = solicitar_recuperacion_password(
        RepoRecuperacionMemoria(None),
        identificador="noexiste@conatel.gob.ve",
        base_frontend="http://localhost:3001",
        enviar_email_fn=mock_email_fn,
        generar_token_fn=MagicMock(),
    )

    assert resultado == MENSAJE_RESPUESTA_GENERICO
    mock_email_fn.assert_not_called()


def test_solicitar_recuperacion_cuenta_sin_correo_no_envia():
    mock_email_fn = MagicMock()
    solicitar_recuperacion_password(
        RepoRecuperacionMemoria(_cuenta(correo=None)), "V-11111111", "http://x",
        enviar_email_fn=mock_email_fn, generar_token_fn=MagicMock(),
    )
    mock_email_fn.assert_not_called()


def test_solicitar_recuperacion_fallo_smtp_no_filtra_el_error_al_cliente():
    def smtp_caido(*args):
        raise ConnectionRefusedError("smtp.interno:587 rechazó la conexión")

    with pytest.raises(ValidationError) as exc:
        solicitar_recuperacion_password(
            RepoRecuperacionMemoria(_cuenta()), "V-11111111", "http://x",
            enviar_email_fn=smtp_caido, generar_token_fn=MagicMock(return_value="t"),
        )
    assert "smtp.interno" not in str(exc.value)


def test_solicitar_recuperacion_identificador_vacio_lanza_validation_error():
    with pytest.raises(ValidationError) as exc:
        solicitar_recuperacion_password(
            RepoRecuperacionMemoria(), "", "http://x",
            enviar_email_fn=MagicMock(), generar_token_fn=MagicMock(),
        )
    assert "correo institucional o cédula" in str(exc.value)


def test_solicitar_recuperacion_auditoria_y_log_enviado(caplog):
    """A10: Resultado 'enviado' registra log INFO y auditoría SUCCESS sin cambiar mensaje."""
    mock_email = MagicMock()
    mock_token = MagicMock(return_value="tok-123")
    mock_auditor = MagicMock()

    with caplog.at_level("INFO", logger="security_backend"):
        res = solicitar_recuperacion_password(
            RepoRecuperacionMemoria(_cuenta(cedula="V-22222222", correo="test@conatel.gob.ve")),
            identificador="V-22222222",
            base_frontend="http://localhost:3001",
            enviar_email_fn=mock_email,
            generar_token_fn=mock_token,
            auditor_fn=mock_auditor,
            metadata={"ip_origen": "192.168.1.50", "user_agent": "Mozilla/5.0"},
        )

    assert res == MENSAJE_RESPUESTA_GENERICO
    mock_email.assert_called_once()
    assert any("resultado=enviado" in r.message and "cedula=V-22222222" in r.message for r in caplog.records)
    mock_auditor.assert_called_once()
    kw = mock_auditor.call_args.kwargs
    assert kw["resultado"] == "SUCCESS"
    assert kw["actor_cedula"] == "V-22222222"
    assert kw["estado_nuevo"]["resultado"] == "enviado"
    assert kw["estado_nuevo"]["correo"] == "test@conatel.gob.ve"
    assert kw["ip_origen"] == "192.168.1.50"


def test_solicitar_recuperacion_auditoria_y_log_cedula_sin_cuenta(caplog):
    """A10: Resultado 'cedula_sin_cuenta' registra log WARNING y auditoría FAILED sin delatar existencia."""
    mock_auditor = MagicMock()

    with caplog.at_level("WARNING", logger="security_backend"):
        res = solicitar_recuperacion_password(
            RepoRecuperacionMemoria(None),
            identificador="V-99999999",
            base_frontend="http://localhost:3001",
            enviar_email_fn=MagicMock(),
            generar_token_fn=MagicMock(),
            auditor_fn=mock_auditor,
            metadata={"ip_origen": "10.0.0.1"},
        )

    assert res == MENSAJE_RESPUESTA_GENERICO
    assert any("resultado=cedula_sin_cuenta" in r.message and "V-99999999" in r.message for r in caplog.records)
    mock_auditor.assert_called_once()
    kw = mock_auditor.call_args.kwargs
    assert kw["resultado"] == "FAILED"
    assert kw["actor_id"] is None
    assert kw["actor_cedula"] == "V-99999999"
    assert kw["estado_nuevo"]["resultado"] == "cedula_sin_cuenta"
    assert kw["estado_nuevo"]["identificador"] == "V-99999999"


def test_solicitar_recuperacion_auditoria_y_log_cuenta_sin_correo(caplog):
    """A10: Resultado 'cuenta_sin_correo' registra log WARNING y auditoría FAILED."""
    mock_auditor = MagicMock()

    with caplog.at_level("WARNING", logger="security_backend"):
        res = solicitar_recuperacion_password(
            RepoRecuperacionMemoria(_cuenta(cedula="V-33333333", correo=None)),
            identificador="V-33333333",
            base_frontend="http://localhost:3001",
            enviar_email_fn=MagicMock(),
            generar_token_fn=MagicMock(),
            auditor_fn=mock_auditor,
        )

    assert res == MENSAJE_RESPUESTA_GENERICO
    assert any("resultado=cuenta_sin_correo" in r.message and "V-33333333" in r.message for r in caplog.records)
    mock_auditor.assert_called_once()
    kw = mock_auditor.call_args.kwargs
    assert kw["resultado"] == "FAILED"
    assert kw["actor_cedula"] == "V-33333333"
    assert kw["estado_nuevo"]["resultado"] == "cuenta_sin_correo"


def test_solicitar_recuperacion_auditoria_y_log_fallo_envio(caplog):
    """A10: Resultado 'fallo_envio' registra log ERROR y auditoría FAILED con detalle del error."""
    mock_auditor = MagicMock()

    def _smtp_falla(*_):
        raise ConnectionResetError("Conexión reiniciada por el servidor SMTP")

    with caplog.at_level("ERROR", logger="security_backend"):
        with pytest.raises(ValidationError):
            solicitar_recuperacion_password(
                RepoRecuperacionMemoria(_cuenta(cedula="V-44444444", correo="fallo@conatel.gob.ve")),
                identificador="V-44444444",
                base_frontend="http://localhost:3001",
                enviar_email_fn=_smtp_falla,
                generar_token_fn=MagicMock(return_value="t-123"),
                auditor_fn=mock_auditor,
            )

    assert any("resultado=fallo_envio" in r.message and "Conexión reiniciada" in r.message for r in caplog.records)
    mock_auditor.assert_called_once()
    kw = mock_auditor.call_args.kwargs
    assert kw["resultado"] == "FAILED"
    assert kw["actor_cedula"] == "V-44444444"
    assert kw["estado_nuevo"]["resultado"] == "fallo_envio"
    assert "Conexión reiniciada" in kw["estado_nuevo"]["error"]


def test_restablecer_password_exitoso():
    repo = RepoRecuperacionMemoria(_cuenta(cedula="V-12345678", password_hash="hash_antiguo_1234567890"))
    mock_validar_token = MagicMock(return_value=(1, "V-12345678", "hash_antiguo_123"))
    mock_validar_fortaleza = MagicMock()

    resultado = restablecer_password(
        repo,
        token="token-valido",
        password_nuevo="Conatel2026!Nueva",
        password_confirmacion="Conatel2026!Nueva",
        validar_token_fn=mock_validar_token,
        validar_fortaleza_fn=mock_validar_fortaleza,
    )

    assert "exitosamente" in resultado
    mock_validar_fortaleza.assert_called_once_with("Conatel2026!Nueva")
    assert repo.restablecidas == [(1, "Conatel2026!Nueva")]


def test_restablecer_password_falla_si_confirmacion_difiere():
    with pytest.raises(ValidationError) as exc:
        restablecer_password(
            RepoRecuperacionMemoria(),
            token="token-cualquiera",
            password_nuevo="Password123!",
            password_confirmacion="PasswordDiferente!",
            validar_token_fn=MagicMock(),
            validar_fortaleza_fn=MagicMock(),
        )
    assert "no coinciden" in str(exc.value)


def test_restablecer_password_rechaza_token_si_password_ya_fue_cambiado_previamente():
    repo = RepoRecuperacionMemoria(_cuenta(cedula="V-12345678", password_hash="NUEVO_HASH_CAMBIADO"))
    mock_validar_token = MagicMock(return_value=(1, "V-12345678", "HASH_ANTERIOR_VIEJO"))

    with pytest.raises(ValidationError) as exc:
        restablecer_password(
            repo,
            token="token-con-hash-antiguo",
            password_nuevo="PasswordValido123!",
            password_confirmacion="PasswordValido123!",
            validar_token_fn=mock_validar_token,
            validar_fortaleza_fn=MagicMock(),
        )
    assert "ya ha sido utilizado" in str(exc.value)
    assert repo.restablecidas == []


def test_restablecer_password_rechaza_cuenta_inactiva():
    repo = RepoRecuperacionMemoria(_cuenta(cedula="V-12345678", activa=False))
    with pytest.raises(ValidationError):
        restablecer_password(
            repo, "t", "PasswordValido123!", "PasswordValido123!",
            validar_token_fn=MagicMock(return_value=(1, "V-12345678", "pbkdf2_sha256$12")),
            validar_fortaleza_fn=MagicMock(),
        )


def test_base_frontend_ignora_origenes_no_confiables(settings):
    from apps.identidad.presentation.views.auth_views import _base_frontend_confiable

    settings.FRONTEND_URL = "http://localhost:3001"
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:3001", "http://intranet:3000"]

    assert _base_frontend_confiable("https://sitio-del-atacante.com") == "http://localhost:3001"
    assert _base_frontend_confiable("") == "http://localhost:3001"
    assert _base_frontend_confiable(None) == "http://localhost:3001"
    assert _base_frontend_confiable("http://intranet:3000/") == "http://intranet:3000"


@patch("apps.identidad.presentation.views.auth_views.solicitar_recuperacion_password_task")
def test_vista_solicitar_recuperacion_api(mock_tarea):
    """La vista encola y responde el mensaje genérico sin esperar al SMTP (anti-enumeración)."""
    from rest_framework.test import APIRequestFactory
    from apps.identidad.application.use_cases.solicitar_recuperacion_password import MENSAJE_RESPUESTA_GENERICO
    from apps.identidad.presentation.views.auth_views import SolicitarRecuperacionPasswordView

    factory = APIRequestFactory()
    view = SolicitarRecuperacionPasswordView.as_view()

    request = factory.post(
        "/api/v1/identidad/auth/solicitar-recuperacion/",
        {"identificador": "usuario@conatel.gob.ve", "frontend_url": "https://evil.example"},
        format="json",
    )
    response = view(request)

    assert response.status_code == 200
    assert response.data["status"] == "success"
    assert response.data["message"] == MENSAJE_RESPUESTA_GENERICO
    identificador, base_frontend = mock_tarea.delay.call_args.args
    assert identificador == "usuario@conatel.gob.ve"
    # la URL maliciosa del cliente nunca llega a la tarea
    assert "evil.example" not in base_frontend


@patch("apps.identidad.presentation.views.auth_views.procesar_solicitud_recuperacion")
@patch("apps.identidad.presentation.views.auth_views.solicitar_recuperacion_password_task")
def test_vista_solicitar_recuperacion_sin_broker_procesa_en_linea(mock_tarea, mock_procesar):
    from rest_framework.test import APIRequestFactory
    from apps.identidad.presentation.views.auth_views import SolicitarRecuperacionPasswordView

    mock_tarea.delay.side_effect = OSError("broker caído")
    request = APIRequestFactory().post(
        "/api/v1/identidad/auth/solicitar-recuperacion/", {"identificador": "12345678"}, format="json",
    )
    response = SolicitarRecuperacionPasswordView.as_view()(request)

    assert response.status_code == 200
    mock_procesar.assert_called_once()


@patch("apps.identidad.infrastructure.tasks.recuperacion_tasks.solicitar_recuperacion_password")
def test_tarea_recuperacion_no_propaga_errores_de_dominio(mock_uc):
    from apps.identidad.infrastructure.tasks.recuperacion_tasks import procesar_solicitud_recuperacion
    from core.domain.exceptions import ValidationError as DomainValidationError

    mock_uc.side_effect = DomainValidationError("No fue posible enviar el correo")
    procesar_solicitud_recuperacion("usuario@conatel.gob.ve", "http://localhost:3001")
    assert mock_uc.call_args.kwargs["base_frontend"] == "http://localhost:3001"


@patch("apps.identidad.presentation.views.auth_views.restablecer_password")
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


@patch("apps.identidad.presentation.views.auth_views.solicitar_recuperacion_password_task")
def test_vista_recuperacion_por_cedula_no_revela_existencia_de_cuenta(mock_tarea):
    """A10: Solicitudes por cédula reciben la misma respuesta 200 y encolan metadatos de auditoría."""
    from rest_framework.test import APIRequestFactory
    from apps.identidad.application.use_cases.solicitar_recuperacion_password import MENSAJE_RESPUESTA_GENERICO
    from apps.identidad.presentation.views.auth_views import SolicitarRecuperacionPasswordView

    factory = APIRequestFactory()
    view = SolicitarRecuperacionPasswordView.as_view()

    for cedula in ["V-11111111", "V-99999999"]:
        req = factory.post(
            "/api/v1/identidad/auth/solicitar-recuperacion/",
            {"identificador": cedula},
            format="json",
            REMOTE_ADDR="192.168.1.100",
            HTTP_USER_AGENT="Mozilla/5.0 TestBrowser",
        )
        resp = view(req)
        assert resp.status_code == 200
        assert resp.data["status"] == "success"
        assert resp.data["message"] == MENSAJE_RESPUESTA_GENERICO

    assert mock_tarea.delay.call_count == 2
    ultimo_llamado = mock_tarea.delay.call_args
    assert ultimo_llamado.args[0] == "V-99999999"
    metadata = ultimo_llamado.kwargs.get("metadata")
    assert metadata is not None
    assert metadata["ip_origen"] == "192.168.1.100"
    assert "TestBrowser" in metadata["user_agent"]
    assert "trace_id" in metadata
