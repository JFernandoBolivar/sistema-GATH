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


def test_obtener_mi_expediente_exitoso():
    from apps.autogestion.application.use_cases.obtener_mi_expediente import obtener_mi_expediente
    from unittest.mock import MagicMock
    from apps.personal.domain.entities.empleado import Empleado

    repo_personal = MagicMock()
    repo_personal.obtener_por_cedula.return_value = Empleado(
        id=1,
        cedula="12345678",
        nombres="Juan",
        apellidos="Pérez",
        sexo_id=1,
        sexo_nombre="MASCULINO",
        correo="juan@conatel.gob.ve",
        telefono_movil="04121234567",
        telefono_habitacion=None,
        fecha_nacimiento="1990-01-01",
        estado_civil_id=1,
        estado_civil_nombre="SOLTERO",
        carnet_patria="00112233",
        total_anos_apn=5.0,
        formacion_academica=[{
            "id": 1,
            "carrera_id": 1,
            "carrera_nombre": "Ingeniería de Telecomunicaciones",
            "nivel_academico_id": 3,
            "nivel_academico_nombre": "PREGRADO",
            "mencion_id": None,
            "mencion_nombre": None,
            "institucion_id": 1,
            "institucion_nombre": "Universidad Central de Venezuela",
        }],
        formacion_complementaria=[{
            "id": 1,
            "capacitacion_id": 10,
            "capacitacion_nombre": "Regulación de Espectro Radioeléctrico",
            "institucion_id": 2,
            "institucion_nombre": "Centro de Estudios de Telecomunicaciones",
            "fecha_inicio": "2024-01-15",
            "fecha_fin": "2024-02-15",
            "dias_completados": "30",
            "horas_completadas": "60",
            "procedencia_id": 1,
            "procedencia_nombre": "INTERNO",
            "grupo_id": 1,
            "grupo_nombre": "TÉCNICO",
        }],
    )
    repo_familiares = MagicMock()
    repo_familiares.listar_por_empleado.return_value = []

    res = obtener_mi_expediente(repo_personal, repo_familiares, "12345678")
    assert res.empleado.cedula == "12345678"
    assert len(res.empleado.formacion_complementaria) == 1
    assert res.empleado.formacion_complementaria[0]["capacitacion_nombre"] == "Regulación de Espectro Radioeléctrico"
    assert res.empleado.formacion_academica[0]["carrera_nombre"] == "Ingeniería de Telecomunicaciones"


def test_obtener_mi_expediente_cedula_invalida_lanza_error():
    from apps.autogestion.application.use_cases.obtener_mi_expediente import obtener_mi_expediente
    from core.domain.exceptions import NotFoundError
    from unittest.mock import MagicMock

    with pytest.raises(NotFoundError):
        obtener_mi_expediente(MagicMock(), MagicMock(), "   ")
