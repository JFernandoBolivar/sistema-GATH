"""Resultado de la verificación de un carnet por un sistema externo autorizado (SILOG)."""
import re
from dataclasses import dataclass

VERSION_CONTRATO_INTEGRACION = 1
_PATRON_HASH = re.compile(r'^[0-9a-f]{64}$')


def normalizar_hash_carnet(valor: str | None) -> str | None:
    """Devuelve el hash en minúsculas si tiene el formato de 64 hex; si no, None."""
    candidato = (valor or '').strip().lower()
    return candidato if _PATRON_HASH.match(candidato) else None


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
