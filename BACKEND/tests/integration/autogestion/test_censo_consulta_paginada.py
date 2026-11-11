"""Censo de vivienda -> Consultar: listado paginado en el servidor, sin N+1."""
import pytest
from rest_framework.test import APIClient

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
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

URL = "/api/v1/autogestion/censo/consultar/"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.pk = 1
        self.id = None
        self.cedula_id = "V-1"
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture
def censados():
    """Siete censados (V-100001..V-100007) con dos respuestas cada uno y uno sin censar."""
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "VENEZOLANO"}
    )
    sexo = SexoModel.objects.create(sexo="M")
    tipo = TipoPreguntaModel.objects.create(nombre="texto")
    preguntas = [
        PreguntasEncuestasModel.objects.create(
            enunciado=f"Pregunta {i}", tipo=tipo, orden=i, activo=True
        )
        for i in (1, 2)
    ]
    for n in range(1, 8):
        emp = EmployeeModel.objects.create(
            cedulaidentidad=f"V-10000{n}", nombres=f"Nombre{n}", apellidos="Prueba", sexoid=sexo
        )
        for p in preguntas:
            RespuestasEncuestaModel.objects.create(empleado=emp, pregunta=p, respuesta="Sí")
    EmployeeModel.objects.create(
        cedulaidentidad="V-999999", nombres="Sin", apellidos="Censo", sexoid=sexo
    )


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def test_repo_primera_pagina_corta_en_la_consulta(censados):
    filas, total = RepoAutogestionORM().consultar_censos_paginado(offset=0, limite=3)

    assert total == 7  # el empleado sin respuestas no cuenta
    assert [f["cedula"] for f in filas] == ["V-100001", "V-100002", "V-100003"]
    assert all(len(f["preguntas"]) == 2 for f in filas)


def test_repo_segunda_pagina_y_ultima_parcial(censados):
    repo = RepoAutogestionORM()
    filas2, _ = repo.consultar_censos_paginado(offset=3, limite=3)
    filas3, total = repo.consultar_censos_paginado(offset=6, limite=3)

    assert [f["cedula"] for f in filas2] == ["V-100004", "V-100005", "V-100006"]
    assert [f["cedula"] for f in filas3] == ["V-100007"]
    assert total == 7


def test_repo_filtra_por_cedula(censados):
    filas, total = RepoAutogestionORM().consultar_censos_paginado(
        offset=0, limite=10, cedula="V-100005"
    )
    assert total == 1
    assert filas[0]["cedula"] == "V-100005"


def test_repo_respuestas_de_la_pagina_sin_n_mas_uno(censados):
    repo = RepoAutogestionORM()
    # Las consultas no crecen con el tamaño de la página: 1 página de 2 y otra de 7 cuestan lo mismo.
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as chica:
        repo.consultar_censos_paginado(offset=0, limite=2)
    with CaptureQueriesContext(connection) as grande:
        repo.consultar_censos_paginado(offset=0, limite=7)
    assert len(grande) == len(chica)


def test_api_pagina_por_defecto_trae_diez_y_el_sobre_paginado(censados, api):
    r = api.get(URL)
    assert r.status_code == 200, r.content
    datos = r.json()["data"]
    assert datos["total"] == 7
    assert datos["pagina"] == 1
    assert datos["tamano"] == 10
    assert datos["total_paginas"] == 1
    assert len(datos["resultados"]) == 7


def test_api_pagina_dos(censados, api):
    r = api.get(URL, {"pagina": 2, "page_size": 3})
    datos = r.json()["data"]
    assert datos["pagina"] == 2
    assert datos["total_paginas"] == 3
    assert [f["cedula"] for f in datos["resultados"]] == ["V-100004", "V-100005", "V-100006"]


def test_api_tope_de_cincuenta(censados, api):
    datos = api.get(URL, {"page_size": 500}).json()["data"]
    assert datos["tamano"] == 50


def test_api_filtro_por_cedula_en_query(censados, api):
    datos = api.get(URL, {"cedula": "V-100002"}).json()["data"]
    assert datos["total"] == 1
    assert datos["resultados"][0]["cedula"] == "V-100002"


def test_api_cedula_en_la_ruta_sigue_devolviendo_lista(censados, api):
    r = api.get(f"{URL}V-100003/")
    assert r.status_code == 200
    datos = r.json()["data"]
    assert isinstance(datos, list) and datos[0]["cedula"] == "V-100003"


def test_api_parametro_invalido_es_400(censados, api):
    assert api.get(URL, {"pagina": "abc"}).status_code == 400
    assert api.get(URL, {"pagina": 0}).status_code == 400
