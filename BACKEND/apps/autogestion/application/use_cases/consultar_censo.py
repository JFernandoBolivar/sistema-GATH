"""
Casos de uso para consultar y registrar respuestas de censo de un empleado.
"""
from apps.autogestion.application.dtos.autogestion_dtos import RespuestaEncuestaDTO
from apps.autogestion.domain.entities.respuesta_encuesta import RespuestaEncuesta
from apps.autogestion.domain.ports.repo_autogestion import RepoAutogestion


def _respuesta_a_dto(r: RespuestaEncuesta) -> RespuestaEncuestaDTO:
    return RespuestaEncuestaDTO(
        id=r.id,
        pregunta_id=r.pregunta_id,
        pregunta_enunciado=r.pregunta_enunciado,
        empleado_cedula=r.empleado_cedula,
        opcion_id=r.opcion_id,
        opcion_texto=r.opcion_texto,
        respuesta_texto=r.respuesta_texto,
    )


def consultar_censo_empleado(
    repo: RepoAutogestion, empleado_cedula: str
) -> list[RespuestaEncuestaDTO]:
    entidades = repo.obtener_respuestas_empleado(empleado_cedula)
    return [_respuesta_a_dto(e) for e in entidades]


def registrar_respuestas_censo(
    repo: RepoAutogestion, empleado_cedula: str, respuestas: list[dict]
) -> list[RespuestaEncuestaDTO]:
    entidades = repo.guardar_respuestas_empleado(
        empleado_cedula=empleado_cedula, respuestas=respuestas
    )
    return [_respuesta_a_dto(e) for e in entidades]
