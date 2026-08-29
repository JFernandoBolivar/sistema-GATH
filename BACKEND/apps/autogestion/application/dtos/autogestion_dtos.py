"""
DTOs de Autogestión (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class OpcionPreguntaDTO:
    id: int
    texto: str
    orden: int = 0


@dataclass(frozen=True)
class PreguntaEncuestaDTO:
    id: int
    enunciado: str
    tipo: str
    orden: int = 0
    activo: bool = True
    validacion: str | None = None
    opciones: list[OpcionPreguntaDTO] = field(default_factory=list)


@dataclass(frozen=True)
class RespuestaEncuestaDTO:
    id: int
    pregunta_id: int
    pregunta_enunciado: str
    empleado_cedula: str
    opcion_id: int | None = None
    opcion_texto: str | None = None
    respuesta_texto: str = ""
