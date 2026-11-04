"""Mensaje 1b: paginación en servidor de `/api/v1/personal/`.

Cubre total, páginas, tope de 50, filtros en servidor, búsqueda con acentos,
payload liviano y consultas constantes.
"""
from datetime import date

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import DependenciaModel
from apps.personal.application.use_cases.listar_personal import listar_personal_paginado
from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM

pytestmark = pytest.mark.django_db

URL_LISTA = "/api/v1/personal/"
URL_DETALLE = "/api/v1/personal/{cedula}/"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.cedula_id = "V-1"
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def catalogos():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "Venezolana"}
    )
    return {
        "sexo": SexoModel.objects.create(sexo="M"),
        "estatus": EstatusModel.objects.create(estatus="ACTIVO"),
        "nomina": TipoNominaModel.objects.create(nomina="CONTRATADO", es_activo=True),
        "nomina_b": TipoNominaModel.objects.create(nomina="OBRERO FIJO", es_activo=True),
        "cargo": DenominacionCargoModel.objects.create(cargo="ANALISTA"),
        "especifico": DenominacionCargoEspecificoModel.objects.create(cargo="ANALISTA I"),
        "dependencia": DependenciaModel.objects.create(Codigo="DEP-1", dependencia="NIVEL DE APOYO"),
    }


def _crear_empleado(indice, catalogos, *, nombres=None, apellidos=None, codigo=None, nomina=None,
                    dependencia=None):
    empleado = EmployeeModel.objects.create(
        cedulaidentidad=f"9900{indice:04d}",
        nombres=nombres or "AUDITORIA",
        apellidos=apellidos or f"PRUEBA {indice}",
        sexoid=catalogos["sexo"],
        nacionalidad_id=1,
    )
    AsigTrabajoModel.objects.create(
        codigo=codigo or f"COD-{indice}",
        employee_id=empleado.cedulaidentidad,
        denominacioncargoid=catalogos["cargo"],
        denominacioncargoespecificoid=catalogos["especifico"],
        tiponominaid=nomina or catalogos["nomina"],
        estatusid=catalogos["estatus"],
        Dependencia=dependencia,
    )
    return empleado


def _crear_varios(cantidad, catalogos, desde=0):
    for i in range(desde, desde + cantidad):
        _crear_empleado(i, catalogos)


def _data(respuesta):
    return respuesta.json()["data"]


def test_payload_de_diez_filas_pesa_menos_de_30_kb(catalogos):
    _crear_varios(10, catalogos)

    respuesta = _cliente("personal.ver").get(f"{URL_LISTA}?page=1&page_size=10")

    assert respuesta.status_code == 200
    data = _data(respuesta)
    assert len(data["results"]) == 10
    assert data["total"] == 10
    assert len(respuesta.content) < 30_000
    assert set(data["results"][0]) == {
        "id",
        "cedula",
        "nombres",
        "apellidos",
        "nombre_completo",
        "sexo_id",
        "sexo_nombre",
        "fecha_nacimiento",
        "contrato_actual",
    }


def test_paginacion_total_y_paginas_sin_repetir(catalogos):
    _crear_varios(12, catalogos)
    api = _cliente("personal.ver")

    primera = _data(api.get(f"{URL_LISTA}?page=1&page_size=10"))
    segunda = _data(api.get(f"{URL_LISTA}?page=2&page_size=10"))

    assert primera["total"] == segunda["total"] == 12
    assert primera["page"] == 1 and segunda["page"] == 2
    assert len(primera["results"]) == 10
    assert len(segunda["results"]) == 2
    assert not {f["cedula"] for f in primera["results"]} & {
        f["cedula"] for f in segunda["results"]
    }


def test_tope_de_page_size_y_alias_limit(catalogos):
    _crear_varios(3, catalogos)
    api = _cliente("personal.ver")

    con_tope = _data(api.get(f"{URL_LISTA}?page_size=100"))
    con_alias = _data(api.get(f"{URL_LISTA}?limit=7"))

    assert con_tope["page_size"] == 50
    assert con_tope["total"] == 3
    assert con_alias["page_size"] == 7


def test_filtros_busqueda_codigo_nomina_y_dependencia(catalogos):
    _crear_empleado(1, catalogos, nombres="JOSÉ", apellidos="PÉREZ", codigo="COD-ESPECIAL")
    _crear_empleado(
        2, catalogos, nombres="MARÍA", apellidos="GÓMEZ", nomina=catalogos["nomina_b"],
        dependencia=catalogos["dependencia"],
    )
    api = _cliente("personal.ver")

    por_acento = _data(api.get(f"{URL_LISTA}?q=PÉREZ"))
    por_codigo = _data(api.get(f"{URL_LISTA}?codigo=ESPECIAL"))
    por_nomina = _data(api.get(f"{URL_LISTA}?tipo_nomina={catalogos['nomina_b'].pk}"))
    por_dependencia = _data(api.get(f"{URL_LISTA}?dependencia_id={catalogos['dependencia'].pk}"))

    assert [f["apellidos"] for f in por_acento["results"]] == ["PÉREZ"]
    assert [f["cedula"] for f in por_codigo["results"]] == ["99000001"]
    assert [f["cedula"] for f in por_nomina["results"]] == ["99000002"]
    assert [f["cedula"] for f in por_dependencia["results"]] == ["99000002"]
    assert por_dependencia["total"] == 1


def test_parametros_invalidos_responden_400(catalogos):
    api = _cliente("personal.ver")

    assert api.get(f"{URL_LISTA}?page=abc").status_code == 400
    assert api.get(f"{URL_LISTA}?page_size=abc").status_code == 400


def test_consultas_constantes_con_10_y_50_filas(catalogos):
    _crear_varios(10, catalogos)
    repo = RepoPersonalORM()

    with CaptureQueriesContext(connection) as con_diez:
        dtos, total = listar_personal_paginado(repo, page=1, page_size=10)
    assert len(dtos) == 10 and total == 10

    _crear_varios(40, catalogos, desde=10)
    with CaptureQueriesContext(connection) as con_cincuenta:
        dtos, total = listar_personal_paginado(repo, page=1, page_size=50)
    assert len(dtos) == 50 and total == 50

    assert len(con_cincuenta) == len(con_diez)


def test_detalle_conserva_el_expediente_anidado(catalogos):
    _crear_empleado(1, catalogos)

    respuesta = _cliente("personal.ver", "personal.ver_detalle").get(
        URL_DETALLE.format(cedula="99000001")
    )

    assert respuesta.status_code == 200
    empleado = respuesta.json()["data"]
    assert "datos_vivienda" in empleado
    assert "antecedentes" in empleado
    assert "contrato_actual" in empleado


def test_detalle_no_duplica_la_consulta_de_antecedentes(catalogos):
    """Fase 2: el total APN y el expediente comparten una sola consulta."""
    empleado = _crear_empleado(1, catalogos)
    AntecedenteServicioModel.objects.create(
        empleado=empleado,
        fecha_ingreso=date(2020, 1, 1),
        fecha_egreso=date(2021, 1, 1),
    )

    with CaptureQueriesContext(connection) as consultas:
        respuesta = _cliente("personal.ver", "personal.ver_detalle").get(
            URL_DETALLE.format(cedula="99000001")
        )

    assert respuesta.status_code == 200
    sqls = [" ".join(c["sql"].split()).lower() for c in consultas.captured_queries]
    de_antecedentes = [s for s in sqls if 'from "antecedentes_servicio"' in s]
    assert len(de_antecedentes) == 1, de_antecedentes
    # 13 desde que el detalle incluye el correo alternativo de autogestión
    # (una consulta constante más, no un N+1).
    assert len(consultas) <= 13, len(consultas)
