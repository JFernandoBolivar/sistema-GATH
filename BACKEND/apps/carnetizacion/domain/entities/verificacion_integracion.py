"""Resultado de la verificación de un carnet por un sistema externo autorizado (SILOG)."""
from dataclasses import dataclass

from apps.carnetizacion.domain.value_objects.security_hash import normalizar_codigo_qr

VERSION_CONTRATO_INTEGRACION = 1


def normalizar_hash_carnet(valor: str | None) -> str | None:
    """Devuelve el código si es 22 base64url o 64 hex (en minúsculas); si no, None."""
    return normalizar_codigo_qr(valor)


@dataclass(frozen=True)
class VerificacionCarnet:
    """Lo mínimo que un sistema integrado necesita; nunca incluye salud ni foto."""
    valido: bool
    estado: str  # VIGENTE | ANULADO | VENCIDO | NO_REGISTRADO
    mensaje: str = ''
    cedula: str | None = None
    nombre: str | None = None
    tipo_credencial: str | None = None
    estado_laboral: str | None = None
    fecha_emision: str | None = None
    fecha_vencimiento: str | None = None
    version: int = VERSION_CONTRATO_INTEGRACION
