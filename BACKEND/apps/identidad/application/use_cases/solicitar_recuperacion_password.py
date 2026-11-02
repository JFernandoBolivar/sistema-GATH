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
"""
import logging
from typing import Callable

from apps.identidad.domain.ports.repo_recuperacion_password import RepoRecuperacionPassword
from core.domain.exceptions import ValidationError

logger = logging.getLogger('security_backend')

MENSAJE_RESPUESTA_GENERICO = (
    "Si los datos ingresados corresponden a un trabajador registrado y activo, "
    "se ha enviado un enlace de recuperación a su correo electrónico institucional."
)


def solicitar_recuperacion_password(
    repo: RepoRecuperacionPassword,
    identificador: str,
    base_frontend: str,
    enviar_email_fn: Callable[[str, str, str], None],
    generar_token_fn: Callable[[int, str, str], str],
) -> str:
    """Procesa la solicitud de recuperación y envía el correo si la cuenta es válida."""
    identificador = (identificador or "").strip()
    if not identificador:
        raise ValidationError("Debe proporcionar su correo institucional o cédula de identidad.")

    cuenta = repo.buscar_activa_por_identificador(identificador)

    # Si la cuenta existe, está activa y tiene correo registrado, enviamos el mensaje
    if cuenta and cuenta.correo:
        token = generar_token_fn(cuenta.id, cuenta.cedula, cuenta.password_hash)
        enlace = f"{base_frontend.rstrip('/')}/restablecer-password?token={token}"

        try:
            enviar_email_fn(cuenta.correo, cuenta.nombre_completo or "Trabajador(a)", enlace)
        except Exception:
            # La respuesta al cliente es genérica (no se filtra el error SMTP); el detalle queda en el log.
            logger.exception("Fallo SMTP al enviar el correo de recuperación (cuenta %s)", cuenta.id)
            raise ValidationError(
                "No fue posible enviar el correo de recuperación en este momento. Intente más tarde."
            ) from None

    return MENSAJE_RESPUESTA_GENERICO
