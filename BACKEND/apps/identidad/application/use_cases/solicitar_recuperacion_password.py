"""
Caso de uso: Solicitar recuperación de contraseña (C-2, S4, S5).

Busca al trabajador por su correo institucional o por su cédula. Si existe una cuenta
activa con correo electrónico configurado, emite un token de un solo uso con vigencia
de 15 minutos y despacha el correo con el enlace de restablecimiento.
Aplica el principio de mitigación de enumeración (OWASP): si el usuario no existe,
la respuesta sigue siendo idéntica para no delatar la existencia de cuentas.

Puro (B4): repositorio, generador de token y envío de correo se inyectan. La URL
base del frontend la decide la vista (solo orígenes de confianza) y llega ya
validada: este caso de uso nunca la toma de datos del cliente.

A10: Se registra en log y auditoría el resultado preciso de la solicitud:
  - enviado: cuenta activa con correo, mensaje despachado.
  - fallo_envio: cuenta activa con correo, pero falló el envío con el error (SMTP / red).
  - cedula_sin_cuenta: no existe cuenta activa para la cédula o identificador provisto.
  - cuenta_sin_correo: existe cuenta activa para la cédula, pero no posee correo configurado.
En todos los casos la respuesta pública al cliente permanece idéntica (mitigación OWASP).
"""
import logging
import uuid
from typing import Any, Callable

from apps.identidad.domain.entities.cuenta_recuperacion import CuentaRecuperacion
from apps.identidad.domain.ports.repo_recuperacion_password import RepoRecuperacionPassword
from core.domain.exceptions import ValidationError

logger = logging.getLogger('security_backend')

MENSAJE_RESPUESTA_GENERICO = (
    "Si los datos ingresados corresponden a un trabajador registrado y activo, "
    "se ha enviado un enlace de recuperación a su correo electrónico institucional."
)

ACCION_RECUPERACION_PASSWORD = 'identidad.recuperacion_password'

RESULTADO_ENVIADO = 'enviado'
RESULTADO_FALLO_ENVIO = 'fallo_envio'
RESULTADO_CEDULA_SIN_CUENTA = 'cedula_sin_cuenta'
RESULTADO_CUENTA_SIN_CORREO = 'cuenta_sin_correo'


def _auditar(
    auditor_fn: Callable[..., Any] | None,
    resultado_clave: str,
    identificador: str,
    cuenta: CuentaRecuperacion | None = None,
    error: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Registra en auditoría dual sin romper el caso de uso si el auditor falla."""
    if not auditor_fn:
        return
    trace_id = (metadata or {}).get('trace_id') or uuid.uuid4().hex
    actor_id = cuenta.id if cuenta else None
    actor_cedula = cuenta.cedula if cuenta else (identificador if '@' not in identificador else '')
    es_exito = (resultado_clave == RESULTADO_ENVIADO)

    estado_nuevo: dict[str, Any] = {
        'resultado': resultado_clave,
        'identificador': identificador,
    }
    if cuenta and cuenta.correo:
        estado_nuevo['correo'] = cuenta.correo
    if error:
        estado_nuevo['error'] = error

    try:
        auditor_fn(
            trace_id=trace_id,
            actor_id=actor_id,
            actor_cedula=actor_cedula,
            actor_rol='TRABAJADOR' if cuenta else '',
            accion=ACCION_RECUPERACION_PASSWORD,
            modulo='identidad',
            recurso_tipo='cuenta',
            recurso_id=str(cuenta.id) if cuenta else '',
            resultado='SUCCESS' if es_exito else 'FAILED',
            ip_origen=(metadata or {}).get('ip_origen'),
            user_agent=(metadata or {}).get('user_agent', ''),
            dispositivo=(metadata or {}).get('dispositivo', 'DESCONOCIDO'),
            estado_nuevo=estado_nuevo,
        )
    except Exception:
        logger.exception("Error al registrar auditoría en recuperación de contraseña")


def solicitar_recuperacion_password(
    repo: RepoRecuperacionPassword,
    identificador: str,
    base_frontend: str,
    enviar_email_fn: Callable[[str, str, str], None],
    generar_token_fn: Callable[[int, str, str], str],
    auditor_fn: Callable[..., Any] | None = None,
    metadata: dict | None = None,
) -> str:
    """Procesa la solicitud de recuperación y envía el correo si la cuenta es válida."""
    identificador = (identificador or "").strip()
    if not identificador:
        raise ValidationError("Debe proporcionar su correo institucional o cédula de identidad.")

    cuenta = repo.buscar_activa_por_identificador(identificador)

    if not cuenta:
        logger.warning(
            "recuperacion_password.resultado resultado=%s identificador=%s",
            RESULTADO_CEDULA_SIN_CUENTA,
            identificador,
        )
        _auditar(
            auditor_fn,
            RESULTADO_CEDULA_SIN_CUENTA,
            identificador=identificador,
            metadata=metadata,
        )
        return MENSAJE_RESPUESTA_GENERICO

    if not cuenta.correo:
        logger.warning(
            "recuperacion_password.resultado resultado=%s identificador=%s cedula=%s",
            RESULTADO_CUENTA_SIN_CORREO,
            identificador,
            cuenta.cedula,
        )
        _auditar(
            auditor_fn,
            RESULTADO_CUENTA_SIN_CORREO,
            identificador=identificador,
            cuenta=cuenta,
            metadata=metadata,
        )
        return MENSAJE_RESPUESTA_GENERICO

    # Cuenta activa con correo configurado: emitir token y despachar correo
    token = generar_token_fn(cuenta.id, cuenta.cedula, cuenta.password_hash)
    enlace = f"{base_frontend.rstrip('/')}/restablecer-password?token={token}"

    try:
        enviar_email_fn(cuenta.correo, cuenta.nombre_completo or "Trabajador(a)", enlace)
    except Exception as exc:
        logger.exception("Fallo SMTP al enviar el correo de recuperación (cuenta %s)", cuenta.id)
        logger.error(
            "recuperacion_password.resultado resultado=%s identificador=%s cedula=%s correo=%s error=%s",
            RESULTADO_FALLO_ENVIO,
            identificador,
            cuenta.cedula,
            cuenta.correo,
            str(exc),
        )
        _auditar(
            auditor_fn,
            RESULTADO_FALLO_ENVIO,
            identificador=identificador,
            cuenta=cuenta,
            error=str(exc),
            metadata=metadata,
        )
        raise ValidationError(
            "No fue posible enviar el correo de recuperación en este momento. Intente más tarde."
        ) from None

    logger.info(
        "recuperacion_password.resultado resultado=%s identificador=%s cedula=%s correo=%s",
        RESULTADO_ENVIADO,
        identificador,
        cuenta.cedula,
        cuenta.correo,
    )
    _auditar(
        auditor_fn,
        RESULTADO_ENVIADO,
        identificador=identificador,
        cuenta=cuenta,
        metadata=metadata,
    )

    return MENSAJE_RESPUESTA_GENERICO
