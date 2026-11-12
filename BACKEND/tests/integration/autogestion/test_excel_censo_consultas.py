"""El export del censo precarga datos en bloque (sin N+1 por empleado)."""
import datetime

import pytest

from apps.autogestion.infrastructure.models.autogestion_models import (
    PreguntasEncuestasModel,
    RespuestasEncuestaModel,
    TipoPreguntaModel,
)
from apps.autogestion.infrastructure.services.excel_service import generar_excel_censo
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


def test_generar_excel_censo_no_hace_una_consulta_por_empleado(django_assert_max_num_queries):
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "VENEZOLANO"},
    )
    sexo, _ = SexoModel.objects.get_or_create(sexo="M")
    tipo, _ = TipoPreguntaModel.objects.get_or_create(nombre="texto")
    pregunta, _ = PreguntasEncuestasModel.objects.get_or_create(
        enunciado="¿Tiene vivienda?",
        defaults={"tipo": tipo, "orden": 1, "activo": True},
    )

    for i in range(10):
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=f"V-8800{i:02d}",
            nombres=f"Persona {i}",
            apellidos="Prueba",
            sexoid=sexo,
            fecha_nacimiento=datetime.date(1990, 1, 1),
        )
        RespuestasEncuestaModel.objects.create(
            empleado=empleado, pregunta=pregunta, respuesta="Sí",
        )

    with django_assert_max_num_queries(12):
        salida = generar_excel_censo()

    assert salida.getvalue()[:2] == b"PK"
