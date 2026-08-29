"""
Tests unitarios del módulo autogestión (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.autogestion.application.use_cases.consultar_censo import (
    consultar_censo_empleado,
    registrar_respuestas_censo,
)
from apps.autogestion.application.use_cases.listar_preguntas import (
    listar_preguntas_censo,
)
from apps.autogestion.application.use_cases.reporte_censo import (
    obtener_reporte_censo_dependencias,
)
from apps.autogestion.domain.entities.pregunta_encuesta import (
    OpcionPregunta,
    PreguntaEncuesta,
)
from apps.autogestion.domain.entities.respuesta_encuesta import RespuestaEncuesta


class RepoAutogestionMemoria:
    def __init__(self):
        self.preguntas = [
            PreguntaEncuesta(
                id=1,
                enunciado="¿Posee vivienda propia?",
                tipo="seleccion_unica",
                orden=1,
                activo=True,
                opciones=[
                    OpcionPregunta(id=10, texto="Sí", orden=1),
                    OpcionPregunta(id=11, texto="No", orden=2),
                ],
            )
        ]
        self.respuestas = [
            RespuestaEncuesta(
                id=1,
                pregunta_id=1,
                pregunta_enunciado="¿Posee vivienda propia?",
                empleado_cedula="12345678",
                opcion_id=10,
                opcion_texto="Sí",
                respuesta_texto="Sí",
            )
        ]

    def listar_preguntas_activas(self):
        return [p for p in self.preguntas if p.activo]

    def obtener_respuestas_empleado(self, empleado_cedula):
        return [r for r in self.respuestas if r.empleado_cedula == empleado_cedula]

    def guardar_respuestas_empleado(self, empleado_cedula, respuestas):
        nuevas = [r for r in self.respuestas if r.empleado_cedula != empleado_cedula]
        for item in respuestas:
            nuevas.append(
                RespuestaEncuesta(
                    id=len(nuevas) + 1,
                    pregunta_id=item['pregunta_id'],
                    pregunta_enunciado="¿Posee vivienda propia?",
                    empleado_cedula=empleado_cedula,
                    opcion_id=item.get('opcion_id'),
                    opcion_texto="No",
                    respuesta_texto=item.get('respuesta', ''),
                )
            )
        self.respuestas = nuevas
        return self.obtener_respuestas_empleado(empleado_cedula)

    def obtener_reporte_dependencias(self, dependencias_ids=None):
        return [
            {
                'dependencia_id': 1,
                'dependencia': 'Tecnología',
                'total_empleados': 10,
                'empleados_censados': 8,
            }
        ]


def test_listar_preguntas_censo():
    repo = RepoAutogestionMemoria()
    preguntas = listar_preguntas_censo(repo)
    assert len(preguntas) == 1
    assert preguntas[0].enunciado == "¿Posee vivienda propia?"
    assert len(preguntas[0].opciones) == 2


def test_consultar_y_registrar_censo():
    repo = RepoAutogestionMemoria()
    resp = consultar_censo_empleado(repo, "12345678")
    assert len(resp) == 1
    assert resp[0].opcion_id == 10

    nuevas_resp = registrar_respuestas_censo(
        repo,
        empleado_cedula="12345678",
        respuestas=[{'pregunta_id': 1, 'opcion_id': 11, 'respuesta': 'No'}],
    )
    assert len(nuevas_resp) == 1
    assert nuevas_resp[0].opcion_id == 11


def test_reporte_censo():
    repo = RepoAutogestionMemoria()
    rep = obtener_reporte_censo_dependencias(repo)
    assert len(rep) == 1
    assert rep[0]['total_empleados'] == 10
