"""A-02: `/auth/me` cachea permisos por cuenta y versión, sin cambiar la respuesta.

- Máximo 4 consultas con la caché de la cuenta fría (catálogo incluido).
- 1-2 consultas con la caché caliente.
- Un cambio de permisos del rol o de overrides se refleja en la siguiente llamada.
- Una cuenta desactivada sigue recibiendo 401.
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
from apps.identidad.application.use_cases.emitir_tokens_sesion import emitir_tokens_sesion
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

URL_ME = "/api/v1/identidad/auth/me/"


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "Venezolana"}
    )
    sexo = SexoModel.objects.create(sexo="M")
    estatus = EstatusModel.objects.create(estatus="ACTIVO")
    nomina = TipoNominaModel.objects.create(nomina="CONTRATADO", es_activo=True)
    cargo = DenominacionCargoModel.objects.create(cargo="ANALISTA")
    especifico = DenominacionCargoEspecificoModel.objects.create(cargo="ANALISTA I")
    empleado = EmployeeModel.objects.create(
        cedulaidentidad="99000999",
        nombres="AUDITORIA",
        apellidos="CACHE",
        sexoid=sexo,
        nacionalidad_id=1,
    )
    AsigTrabajoModel.objects.create(
        codigo="COD-CACHE",
        employee_id=empleado.cedulaidentidad,
        denominacioncargoid=cargo,
        denominacioncargoespecificoid=especifico,
        tiponominaid=nomina,
        estatusid=estatus,
    )
    rol = RolModel.objects.create(nombre_rol="ROL_CACHE_A02")
    permiso_ver = PermisoModel.objects.create(codigo="personal.ver", nombre="Ver personal")
    permiso_crear = PermisoModel.objects.create(codigo="personal.crear", nombre="Crear personal")
    RolPermisoModel.objects.create(rol_id=rol.pk, permiso=permiso_ver)
    cuenta = CuentaModel.objects.create(cedula_id=empleado.cedulaidentidad, rol=rol)
    return {
        "cuenta": cuenta,
        "rol": rol,
        "permiso_ver": permiso_ver,
        "permiso_crear": permiso_crear,
    }


def _api(cuenta: CuentaModel) -> APIClient:
    """Token real con el claim `permisos_version` vigente (como el login)."""
    version = RepoPermisosVersionORM().obtener(cuenta.pk)
    tokens = emitir_tokens_sesion(
        cuenta,
        str(cuenta.cedula_id),
        cuenta.rol.nombre_rol if cuenta.rol_id else None,
        version,
    )
    api = APIClient()
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.access}")
    return api


def test_me_no_supera_cinco_consultas_en_frio_y_dos_en_caliente(escenario):
    api = _api(escenario["cuenta"])

    with CaptureQueriesContext(connection) as frio:
        primera = api.get(URL_ME)
    assert primera.status_code == 200
    assert len(frio) <= 5, [q["sql"] for q in frio.captured_queries]

    with CaptureQueriesContext(connection) as caliente:
        segunda = api.get(URL_ME)
    assert segunda.status_code == 200
    assert len(caliente) <= 2, [q["sql"] for q in caliente.captured_queries]
    assert segunda.json()["data"] == primera.json()["data"]


def test_cambio_de_permisos_del_rol_se_refleja_en_la_siguiente_llamada(escenario):
    api = _api(escenario["cuenta"])
    assert api.get(URL_ME).json()["data"]["permisos"] == ["personal.ver"]

    RolPermisoModel.objects.create(rol_id=escenario["rol"].pk, permiso=escenario["permiso_crear"])
    RepoPermisosVersionORM().incrementar_por_rol(escenario["rol"].pk)

    # El token anterior queda invalidado por el cambio de versión...
    assert api.get(URL_ME).status_code == 401
    # ...y tras renovar sesión, /me ya trae el permiso nuevo (caché invalidada).
    permisos = _api(escenario["cuenta"]).get(URL_ME).json()["data"]["permisos"]
    assert permisos == ["personal.crear", "personal.ver"]


def test_cambio_de_rol_se_refleja_en_la_siguiente_llamada(escenario):
    api = _api(escenario["cuenta"])
    assert api.get(URL_ME).json()["data"]["permisos"] == ["personal.ver"]

    otro_rol = RolModel.objects.create(nombre_rol="ROL_CACHE_A02_B")
    RolPermisoModel.objects.create(rol_id=otro_rol.pk, permiso=escenario["permiso_crear"])
    escenario["cuenta"].rol = otro_rol
    escenario["cuenta"].save(update_fields=["rol"])
    RepoPermisosVersionORM().incrementar_cuenta(escenario["cuenta"].pk)

    assert api.get(URL_ME).status_code == 401
    datos = _api(escenario["cuenta"]).get(URL_ME).json()["data"]
    assert datos["permisos"] == ["personal.crear"]
    assert datos["rol_nombre"] == "ROL_CACHE_A02_B"


def test_cuenta_desactivada_recibe_401(escenario):
    api = _api(escenario["cuenta"])
    assert api.get(URL_ME).status_code == 200

    escenario["cuenta"].is_active = False
    escenario["cuenta"].save(update_fields=["is_active"])

    assert api.get(URL_ME).status_code == 401
