"""
Value Object `SecurityHashCarnet` del dominio de carnetización.

Código de seguridad único de un carnet emitido (`security_hash`, columna
`CharField(max_length=64)`). Admite dos formatos, ambos válidos para siempre:

- Corto (carnets y credenciales NUEVOS): `secrets.token_urlsafe(16)`, 22
  caracteres base64url con 128 bits de azar. Distingue mayúsculas y minúsculas.
- Largo (carnets anteriores): SHA-256 hexadecimal en minúsculas, 64 caracteres.

El QR codifica `<FRONTEND_URL>/carnet/<codigo>`; el código corto reduce los
módulos del QR y lo hace más legible con un teléfono. Sin Django ni DRF (B1).
"""
import re
import secrets
from dataclasses import dataclass

_HASH_LARGO_RE = re.compile(r'[0-9a-f]{64}')
_CODIGO_CORTO_RE = re.compile(r'[A-Za-z0-9_-]{22}')


def generar_codigo_qr() -> str:
    """Código nuevo de 22 caracteres base64url (128 bits), imposible de adivinar."""
    return secrets.token_urlsafe(16)


def normalizar_codigo_qr(valor: str | None) -> str | None:
    """Devuelve el código listo para consultar o None si el formato no es válido.

    El formato largo se pasa a minúsculas (era hex); el corto se respeta tal cual
    porque base64url distingue mayúsculas.
    """
    candidato = (valor or '').strip()
    if _CODIGO_CORTO_RE.fullmatch(candidato):
        return candidato
    candidato = candidato.lower()
    return candidato if _HASH_LARGO_RE.fullmatch(candidato) else None


@dataclass(frozen=True)
class SecurityHashCarnet:
    """Código de seguridad del carnet: 22 base64url (nuevo) o 64 hex (anterior)."""

    valor: str

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        if normalizar_codigo_qr(self.valor) != self.valor:
            raise ValidationError(
                f"Código de seguridad inválido: '{self.valor}'. "
                'Se espera 22 caracteres base64url o un SHA-256 hexadecimal de 64 caracteres.'
            )

    def __str__(self) -> str:
        return self.valor
