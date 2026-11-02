"""
Casos de uso para consultar el catálogo de preguntas del censo.
"""
from apps.autogestion.application.dtos.autogestion_dtos import (
    OpcionPreguntaDTO,
    PreguntaEncuestaDTO,
)
from apps.autogestion.domain.ports.repo_autogestion import RepoAutogestion


def listar_preguntas_censo(repo: RepoAutogestion) -> list[PreguntaEncuestaDTO]:
    entidades = repo.listar_preguntas_activas()
    return [
        PreguntaEncuestaDTO(
            id=p.id,
            enunciado=p.enunciado,
            tipo=p.tipo,
            orden=p.orden,
            activo=p.activo,
            validacion=p.validacion,
            opciones=[
                OpcionPreguntaDTO(id=o.id, texto=o.texto, orden=o.orden)
                for o in p.opciones
            ],
        )
        for p in entidades
    ]
