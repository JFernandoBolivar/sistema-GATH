"""
Value Object `MotivoEgreso` del dominio de pasivos.

Motivo por el cual una persona activa transiciona a pasivo (jubilación,
pensión, sobrevivencia, etc.). No vacío y con texto seguro (sin marcado
HTML). Inmutable con validación en construcción (regla B5), sin Django ni
DRF (regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class MotivoEgreso:
    """Motivo de egreso; no vacío y sin contenido HTML."""

    valor: str

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        texto = self.valor.strip()
        if not texto:
            raise ValidationError('El motivo de egreso no puede estar vacío.')
        if '<' in texto or '>' in texto:
            raise ValidationError('El motivo de egreso no puede contener HTML.')

    def __str__(self) -> str:
        return self.valor
