"""
Value Object `EstadoCargo` del dominio de cargos.

Estado de ocupación de un puesto de trabajo en la plantilla. Invariante de
dominio: un cargo está exactamente en uno de dos estados mutuamente
excluyentes — `activo` (ocupado) o `vacante` (sin empleado) — nunca ambos a
la vez, y nunca ninguno. Inmutable con validación en construcción (regla B5),
sin Django ni DRF (regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class EstadoCargo:
    """Estado de ocupación de un cargo; `activo` y `vacante` son excluyentes."""

    activo: bool
    vacante: bool

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        if not isinstance(self.activo, bool) or not isinstance(self.vacante, bool):
            raise ValidationError('El estado del cargo debe expresarse con valores booleanos.')
        if self.activo == self.vacante:
            raise ValidationError(
                'El cargo debe estar exactamente en un estado: activo o vacante, '
                'nunca ambos ni ninguno.'
            )

    @property
    def esta_vacante(self) -> bool:
        """Conveniencia: `True` si el cargo está sin empleado."""
        return self.vacante
