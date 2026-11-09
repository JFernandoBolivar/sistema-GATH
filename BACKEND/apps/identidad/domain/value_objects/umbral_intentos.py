"""
Value Object `UmbralIntentos` del dominio de identidad (B3.12).

Cantidad de intentos fallidos consecutivos que dispara el bloqueo de una
cuenta de acceso. Inmutable con validación en construcción (regla B5).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class UmbralIntentos:
    """Umbral de intentos fallidos; debe ser un entero positivo."""

    valor: int

    def __post_init__(self):
        if isinstance(self.valor, bool) or not isinstance(self.valor, int) \
                or self.valor < 1:
            from core.domain.exceptions import ValidationError

            raise ValidationError(
                'El umbral de intentos debe ser un entero positivo.'
            )
