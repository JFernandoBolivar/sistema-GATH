"""Resultado de la verificación de un carnet por un sistema externo autorizado (SILOG)."""
import re
from dataclasses import dataclass

from apps.carnetizacion.domain.value_objects.security_hash import normalizar_codigo_qr

VERSION_CONTRATO_INTEGRACION = 1


def normalizar_hash_carnet(valor: str | None) -> str | None:
    """Devuelve el código si es 22 base64url o 64 hex (en minúsculas); si no, None."""
    return normalizar_codigo_qr(valor)


_CEDULA_RE = re.compile(r'^([VE])?-?(\d{6,9})$')


def normalizar_documento(documento: str | None) -> tuple[str | None, str | None]:
    """Cédula venezolana o extranjera -> (solo dígitos, 'V'|'E'|None); otro documento -> (None, None).

    Acepta `V-12.345.678`, `e12345678` o `12345678`. Un pasaporte u otro documento no
    numérico no es una cédula: se devuelve (None, None) y el original va en `documento`.
    """
    limpio = re.sub(r'[\s.]', '', (documento or '')).upper()
    m = _CEDULA_RE.fullmatch(limpio)
    if not m:
        return None, None
    return m.group(2), m.group(1)


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
    nacionalidad: str | None = None  # 'V' | 'E' | None (desconocida o documento no es cédula)
    documento: str | None = None     # solo credenciales externas: documento tal como se registró
    version: int = VERSION_CONTRATO_INTEGRACION
