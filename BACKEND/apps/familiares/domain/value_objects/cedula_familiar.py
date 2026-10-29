"""
Value Object `CedulaFamiliar` del dominio de familiares.

Cédula de identidad de un miembro de la carga familiar. Reutiliza el Value
Object transversal `core.domain.value_objects.Cedula` (B16) para validar el
formato canónico venezolano (`VE`/`E` seguido de 6 a 9 dígitos) en lugar de
duplicar la expresión
regular. Inmutable con validación en construcción (regla B5), sin Django ni
DRF (regla B1).
"""
from dataclasses import dataclass

from core.domain.value_objects import Cedula


@dataclass(frozen=True)
class CedulaFamiliar:
    """Cédula del familiar; delega la validación de formato al VO transversal."""

    valor: str

    def __post_init__(self):
        Cedula(self.valor)  # valida el formato; lanza ValidationError si es inválido

    @property
    def cedula(self) -> Cedula:
        """Acceso al VO transversal subyacente, ya validado."""
        return Cedula(self.valor)

    def __str__(self) -> str:
        return self.valor
