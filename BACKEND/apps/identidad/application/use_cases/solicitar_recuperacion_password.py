"""
Caso de uso: Solicitar recuperación de contraseña (C-2, S4, S5).

Busca al trabajador por su correo institucional o por su cédula. Si existe una cuenta
activa con correo electrónico configurado, emite un token de un solo uso con vigencia
de 15 minutos y despacha el correo con el enlace de restablecimiento.
Aplica el principio de mitigación de enumeración (OWASP): si el usuario no existe,
la respuesta sigue siendo idéntica para no delatar la existencia de cuentas.
"""
from typing import Callable
from django.conf import settings

from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.tokens.password_reset_token import generar_token_recuperacion
from apps.identidad.infrastructure.emails.recuperacion_email import enviar_correo_recuperacion
from core.domain.exceptions import ValidationError

MENSAJE_RESPUESTA_GENERICO = (
    "Si los datos ingresados corresponden a un trabajador registrado y activo, "
    "se ha enviado un enlace de recuperación a su correo electrónico institucional."
)


def solicitar_recuperacion_password(
    identificador: str,
    base_frontend: str = None,
    enviar_email_fn: Callable[[str, str, str], None] = enviar_correo_recuperacion,
    generar_token_fn: Callable[[int, str, str], str] = generar_token_recuperacion,
) -> str:
    """Procesa la solicitud de recuperación y envía el correo si la cuenta es válida."""
    identificador = (identificador or "").strip()
    if not identificador:
        raise ValidationError("Debe proporcionar su correo institucional o cédula de identidad.")

    # Búsqueda por correo o por cédula
    qs = CuentaModel.objects.select_related("cedula").filter(is_active=True)
    if "@" in identificador:
        cuenta = qs.filter(cedula__correo__iexact=identificador).first()
    else:
        cuenta = qs.filter(cedula_id=identificador).first()

    # Si la cuenta existe, está activa y tiene correo registrado, enviamos el mensaje
    if cuenta and cuenta.cedula and cuenta.cedula.correo:
        correo_destino = cuenta.cedula.correo.strip()
        nombres = f"{cuenta.cedula.nombres or ''} {cuenta.cedula.apellidos or ''}".strip()
        nombre_completo = nombres or "Trabajador(a)"

        token = generar_token_fn(cuenta.pk, str(cuenta.cedula_id), cuenta.password)
        base = (base_frontend or getattr(settings, "FRONTEND_URL", "http://localhost:3001")).rstrip("/")
        enlace = f"{base}/restablecer-password?token={token}"

        try:
            enviar_email_fn(correo_destino, nombre_completo, enlace)
        except Exception:
            # En caso de fallo de red en SMTP durante el envío, registramos y permitimos respuesta
            # o relanzamos según sea necesario en entorno controlado.
            raise ValidationError("No fue posible enviar el correo de recuperación en este momento. Intente más tarde.")

    return MENSAJE_RESPUESTA_GENERICO
