"""
Value Object `RespuestaCenso` del dominio de autogestión.

Texto libre con el que un empleado responde a una pregunta de censo o encuesta
(`respuesta_texto`). No vacío y con texto seguro (sin marcado HTML).
Inmutable con validación en construcción (regla B5), sin Django ni DRF
(regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class RespuestaCenso:
    """Respuesta textual de un censo; no vacía y sin contenido HTML."""

    valor: str

    def __post_init__(self):
        from core.domain.exceptions import ValidationError

        texto = self.valor.strip()
        if not texto:
            raise ValidationError('La respuesta del censo no puede estar vacía.')
        if '<' in texto or '>' in texto:
            raise ValidationError('La respuesta del censo no puede contener HTML.')

    def __str__(self) -> str:
        return self.valor
