"""Reglas del enlace de activación (D-10). Puro: sin persistencia ni Django.

  - El token es aleatorio (32 bytes, urlsafe) y en la base solo vive su sha256.
  - Vigencia: el parámetro `captacion.horas_vigencia_enlace_activacion` (48 h por defecto, 1 a 168) y NUNCA más allá
    de la ventana del expediente.
  - La cédula es el segundo factor: 5 cédulas equivocadas bloquean el enlace.
"""
import hashlib
import secrets
from dataclasses import replace
from datetime import datetime, timedelta

from apps.postulacion.domain.entities.enlace_activacion import EnlaceActivacion
from apps.postulacion.domain.errores import EnlaceBloqueado, EnlaceInvalido, EnlaceUsado, EnlaceVencido

BYTES_TOKEN = 32
MAX_INTENTOS_CEDULA = 5
HORAS_VIGENCIA_DEFECTO = 48


def generar_token() -> str:
    return secrets.token_urlsafe(BYTES_TOKEN)


def hash_de_token(token: str) -> str:
    return hashlib.sha256((token or '').encode('utf-8')).hexdigest()


def vencimiento_del_enlace(ahora: datetime, horas: int, ventana_vence_el: datetime) -> datetime:
    """El menor entre `ahora + horas` y el fin de la ventana del expediente."""
    return min(ahora + timedelta(hours=horas), ventana_vence_el)


def exigir_utilizable(enlace: EnlaceActivacion | None, ahora: datetime) -> EnlaceActivacion:
    """Valida el estado del enlace (sin consumirlo). El orden decide qué mensaje ve la persona."""
    if enlace is None or enlace.revocado:
        raise EnlaceInvalido()
    if enlace.usado_el is not None:
        raise EnlaceUsado()
    if ahora > enlace.vence_el:
        raise EnlaceVencido()
    if enlace.intentos >= MAX_INTENTOS_CEDULA:
        raise EnlaceBloqueado()
    return enlace


def tras_cedula_incorrecta(enlace: EnlaceActivacion) -> EnlaceActivacion:
    return replace(enlace, intentos=enlace.intentos + 1)


def enmascarar_correo(correo: str) -> str:
    """`juan.perez@gmail.com` -> `ju***@gmail.com` (nunca el correo completo en lo que ve Captación)."""
    correo = (correo or '').strip()
    local, arroba, dominio = correo.partition('@')
    if not arroba:
        return '***'
    return f'{local[:2]}***@{dominio}'
