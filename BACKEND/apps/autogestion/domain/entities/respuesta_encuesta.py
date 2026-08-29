"""
Entidad de Dominio `RespuestaEncuesta`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class RespuestaEncuesta:
    id: int
    pregunta_id: int
    pregunta_enunciado: str
    empleado_cedula: str
    opcion_id: int | None = None
    opcion_texto: str | None = None
    respuesta_texto: str = ""
