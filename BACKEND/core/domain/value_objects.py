"""
Value Objects transversales (B2.1).

Cada VO valida su invariante en el constructor y es inmutable
(`@dataclass(frozen=True)`, regla B5). Sin Django, sin DRF, sin ORM (regla B1).
"""
import re
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

_CEDULA_RE = re.compile(r'[VE]-\d{6,9}')
_EMAIL_RE = re.compile(r'[^@\s]+@[^@\s]+\.[^@\s]+')
_TELEFONO_RE = re.compile(r'0\d{3}-?\d{7}')


@dataclass(frozen=True)
class Cedula:
    """Cédula de identidad venezolana canónica: prefijo V/E + 6 a 9 dígitos."""

    valor: str

    def __post_init__(self):
        if not _CEDULA_RE.fullmatch(self.valor):
            raise ValidationError(f"Cédula con formato inválido: '{self.valor}'.")

    def __str__(self) -> str:
        return self.valor


@dataclass(frozen=True)
class Email:
    """Dirección de correo electrónico validada."""

    valor: str

    def __post_init__(self):
        if not _EMAIL_RE.fullmatch(self.valor):
            raise ValidationError(f"Correo electrónico con formato inválido: '{self.valor}'.")

    def __str__(self) -> str:
        return self.valor


@dataclass(frozen=True)
class Telefono:
    """Número telefónico venezolano: código de área de 4 dígitos + 7 dígitos."""

    valor: str

    def __post_init__(self):
        normalizado = self.valor.replace(' ', '').replace('(', '').replace(')', '')
        if not _TELEFONO_RE.fullmatch(normalizado):
            raise ValidationError(f"Teléfono con formato inválido: '{self.valor}'.")

    def __str__(self) -> str:
        return self.valor
