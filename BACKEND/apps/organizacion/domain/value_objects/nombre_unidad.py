"""
Value Object `NombreUnidad` del dominio de organización.

Denomina cualquier unidad del organigrama institucional: dependencia,
dirección general, dirección de línea, coordinación u organismo adscrito.
Inmutable y con validación en construcción (regla B5): no vacío, longitud
entre 2 y 100 caracteres y sin contenido HTML (regla B1 — dominio puro).
"""
from dataclasses import dataclass

_MAX_LONGITUD = 100
_MIN_LONGITUD = 2


@dataclass(frozen=True)
class NombreUnidad:
    """Nombre de una unidad orgánica del organigrama; valida su invariante."""

    valor: str

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        texto = self.valor.strip()
        if not texto:
            raise ValidationError('El nombre de la unidad no puede estar vacío.')
        if not (_MIN_LONGITUD <= len(texto) <= _MAX_LONGITUD):
            raise ValidationError(
                f'El nombre de la unidad debe tener entre {_MIN_LONGITUD} '
                f'y {_MAX_LONGITUD} caracteres.'
            )
        if '<' in texto or '>' in texto:
            raise ValidationError('El nombre de la unidad no puede contener HTML.')

    def __str__(self) -> str:
        return self.valor
