"""
Value Object `CodigoCatalogo` del dominio de catálogos.

Código mnemónico de un elemento de tabla maestra (Sexo, Estatus, Tipo Nómina,
etc.). Restringido a minúsculas, dígitos y guiones como separador, sin
guiones iniciales/finales ni dobles. Inmutable con validación en construcción
(regla B5), sin Django ni DRF (regla B1).
"""
import re
from dataclasses import dataclass

_CODIGO_RE = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')


@dataclass(frozen=True)
class CodigoCatalogo:
    """Código mnemónico `[a-z0-9]` separado por guiones; valida su invariante."""

    valor: str

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        if not _CODIGO_RE.fullmatch(self.valor):
            raise ValidationError(
                f"Código de catálogo inválido: '{self.valor}'. "
                'Se esperan minúsculas, dígitos y guiones como separador.'
            )

    def __str__(self) -> str:
        return self.valor
