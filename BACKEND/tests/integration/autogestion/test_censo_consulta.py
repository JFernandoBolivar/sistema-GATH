"""Regresión: el censo con respuestas y antecedentes no debe fallar al serializar."""
import datetime

import pytest

from apps.autogestion.infrastructure.models.autogestion_models import (
    PreguntasEncuestasModel,
    RespuestasEncuestaModel,
    TipoPreguntaModel,
)
from apps.autogestion.infrastructure.repositories.repo_autogestion_orm import (
    RepoAutogestionORM,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


def test_consultar_censos_calcula_apn_con_antecedentes():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "VENEZOLANO"}
    )
    sexo = SexoModel.objects.create(sexo="M")
    empleado = EmployeeModel.objects.create(
        cedulaidentidad="V-999999",
        nombres="Ana",
        apellidos="Pérez",
        sexoid=sexo,
    )
    AntecedenteServicioModel.objects.create(
        empleado=empleado,
        fecha_ingreso=datetime.date(2020, 1, 1),
        fecha_egreso=datetime.date(2021, 1, 1),
    )
    tipo = TipoPreguntaModel.objects.create(nombre="texto")
    pregunta = PreguntasEncuestasModel.objects.create(
        enunciado="¿Tiene vivienda?",
        tipo=tipo,
        orden=1,
        activo=True,
    )
    RespuestasEncuestaModel.objects.create(
        empleado=empleado,
        pregunta=pregunta,
        respuesta="Sí",
    )

    filas = RepoAutogestionORM().consultar_todos_censos(cedula="V-999999")

    assert len(filas) == 1
    assert filas[0]["cedula"] == "V-999999"
    assert filas[0]["total_apn"]["years"] == 1
    assert filas[0]["total_apn"]["months"] == 0
    assert filas[0]["preguntas"][0]["pregunta"] == "¿Tiene vivienda?"
