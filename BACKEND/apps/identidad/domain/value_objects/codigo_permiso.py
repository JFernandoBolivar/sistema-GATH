"""
Value Object `CodigoPermiso` del dominio de identidad (B3.1, Contrato C-3).

Formato canónico `[modulo].[accion]`, en minúsculas: el código nombra el
módulo para que un log de auditoría identifique el módulo afectado sin
consultar otra tabla (§I.6.9). Inmutable y con validación en construcción (B5).
"""
import re
from dataclasses import dataclass

_CODIGO_RE = re.compile(r'[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*')


@dataclass(frozen=True)
class CodigoPermiso:
    """Código `[modulo].[accion]` de un permiso; valida su invariante aquí."""

    valor: str

    def __post_init__(self):
        if not _CODIGO_RE.fullmatch(self.valor):
            from core.domain.exceptions import ValidationError

            raise ValidationError(
                f"Código de permiso inválido: '{self.valor}'. "
                "Se espera 'modulo.accion' en minúsculas."
            )

    @property
    def modulo(self) -> str:
        """Segmento del módulo (`personal` en `personal.crear`)."""
        return self.valor.split('.', 1)[0]

    @property
    def accion(self) -> str:
        """Segmento de la acción (`crear` en `personal.crear`)."""
        return self.valor.split('.', 1)[1]

    def __str__(self) -> str:
        return self.valor
