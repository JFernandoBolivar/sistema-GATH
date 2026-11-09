"""
Mappers de Autogestión.
"""
from apps.autogestion.domain.entities.pregunta_encuesta import (
    OpcionPregunta,
    PreguntaEncuesta,
)
from apps.autogestion.domain.entities.respuesta_encuesta import RespuestaEncuesta
from apps.autogestion.infrastructure.models.autogestion_models import (
    PreguntasEncuestasModel,
    RespuestasEncuestaModel,
)


def pregunta_a_entidad(modelo: PreguntasEncuestasModel) -> PreguntaEncuesta:
    opciones = [
        OpcionPregunta(id=o.pk, texto=o.tipo_opcion, orden=o.orden)
        for o in modelo.opciones.all().order_by('orden')
    ]
    return PreguntaEncuesta(
        id=modelo.pk,
        enunciado=modelo.enunciado,
        tipo=modelo.tipo.nombre if modelo.tipo else "texto",
        orden=modelo.orden,
        activo=modelo.activo,
        validacion=modelo.validacion,
        opciones=opciones,
    )


def respuesta_a_entidad(modelo: RespuestasEncuestaModel) -> RespuestaEncuesta:
    return RespuestaEncuesta(
        id=modelo.pk,
        pregunta_id=modelo.pregunta_id,
        pregunta_enunciado=modelo.pregunta.enunciado if modelo.pregunta else "",
        empleado_cedula=str(modelo.empleado_id),
        opcion_id=modelo.opcion_id,
        opcion_texto=modelo.opcion.tipo_opcion if modelo.opcion else None,
        respuesta_texto=modelo.respuesta,
    )
