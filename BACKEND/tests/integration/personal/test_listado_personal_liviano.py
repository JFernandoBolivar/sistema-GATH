"""A-01: el listado de personal activo debe ser liviano.

- Payload de 10 filas por debajo de 30 KB (solo columnas de la tabla).
- Número de consultas constante con N=10 y N=50 (sin N+1).
- El detalle conserva el expediente anidado completo.
"""
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
from apps.personal.application.use_cases.listar_personal import listar_personal
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
    sexo = SexoModel.objects.create(sexo="M")
    estatus = EstatusModel.objects.create(estatus="ACTIVO")
    nomina = TipoNominaModel.objects.create(nomina="CONTRATADO", es_activo=True)
    cargo = DenominacionCargoModel.objects.create(cargo="ANALISTA")
    especifico = DenominacionCargoEspecificoModel.objects.create(cargo="ANALISTA I")
    return {
        "sexo": sexo,
        "estatus": estatus,
        "nomina": nomina,
        "cargo": cargo,
        "especifico": especifico,
    }


def _crear_empleados(cantidad: int, catalogos, desde: int = 0) -> None:
    empleados = [
        EmployeeModel(
            cedulaidentidad=f"9900{i:04d}",
            nombres="AUDITORIA",
            apellidos=f"PRUEBA {i}",
            sexoid=catalogos["sexo"],
            nacionalidad_id=1,
        )
        for i in range(desde, desde + cantidad)
    ]
    EmployeeModel.objects.bulk_create(empleados)
    AsigTrabajoModel.objects.bulk_create(
        [
            AsigTrabajoModel(
                codigo=f"COD-{i}",
                employee_id=empleado.cedulaidentidad,
                denominacioncargoid=catalogos["cargo"],
                denominacioncargoespecificoid=catalogos["especifico"],
                tiponominaid=catalogos["nomina"],
                estatusid=catalogos["estatus"],
            )
            for i, empleado in zip(range(desde, desde + cantidad), empleados)
        ]
    )


def test_payload_de_diez_filas_pesa_menos_de_30_kb(catalogos):
    _crear_empleados(10, catalogos)

    respuesta = _cliente("personal.ver").get(URL_LISTA)

    assert respuesta.status_code == 200
    filas = respuesta.json()["data"]
    assert len(filas) == 10
    assert len(respuesta.content) < 30_000
    # Solo las claves de la tabla; el expediente no viaja en el listado.
    assert set(filas[0]) == {
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


def test_consultas_constantes_con_10_y_50_filas(catalogos):
    _crear_empleados(10, catalogos)
    repo = RepoPersonalORM()

    with CaptureQueriesContext(connection) as con_diez:
        assert len(listar_personal(repo)) == 10

    _crear_empleados(40, catalogos, desde=10)
    with CaptureQueriesContext(connection) as con_cincuenta:
        assert len(listar_personal(repo)) == 50

    assert len(con_cincuenta) == len(con_diez)


def test_detalle_conserva_el_expediente_anidado(catalogos):
    _crear_empleados(1, catalogos)

    respuesta = _cliente("personal.ver", "personal.ver_detalle").get(
        URL_DETALLE.format(cedula="99000000")
    )

    assert respuesta.status_code == 200
    empleado = respuesta.json()["data"]
    assert "datos_vivienda" in empleado
    assert "antecedentes" in empleado
    assert "contrato_actual" in empleado
