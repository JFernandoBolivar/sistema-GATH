"""
Entidad de Dominio `PreguntaEncuesta` (Regla B1).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class OpcionPregunta:
    id: int
    texto: str
    orden: int = 0


@dataclass(frozen=True)
class PreguntaEncuesta:
    id: int
    enunciado: str
    tipo: str
    orden: int = 0
    activo: bool = True
    validacion: str | None = None
    opciones: list[OpcionPregunta] = field(default_factory=list)
