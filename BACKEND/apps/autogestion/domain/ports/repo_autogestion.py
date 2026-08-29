"""
Puerto del Repositorio de Autogestión (Reglas B1, B21).
"""
from typing import Protocol

from apps.autogestion.domain.entities.pregunta_encuesta import PreguntaEncuesta
from apps.autogestion.domain.entities.respuesta_encuesta import RespuestaEncuesta


class RepoAutogestion(Protocol):
    def listar_preguntas_activas(self) -> list[PreguntaEncuesta]:
        ...

    def obtener_respuestas_empleado(self, empleado_cedula: str) -> list[RespuestaEncuesta]:
        ...

    def guardar_respuestas_empleado(self, empleado_cedula: str, respuestas: list[dict]) -> list[RespuestaEncuesta]:
        ...

    def obtener_reporte_dependencias(self, dependencias_ids: list[int] | None = None) -> list[dict]:
        ...
