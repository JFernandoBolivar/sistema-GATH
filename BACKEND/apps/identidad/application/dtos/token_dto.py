"""
DTO de salida de la emisión/rotación de tokens de sesión (R-11).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class TokensEmitidosDTO:
    """Par access/refresh emitido o rotado."""

    access: str
    refresh: str
