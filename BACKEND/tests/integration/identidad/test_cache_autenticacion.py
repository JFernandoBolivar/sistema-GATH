"""L-NEW2/L-NEW1: caché de autenticación y permisos por petición."""
import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

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
from apps.identidad.application.use_cases.emitir_tokens_sesion import emitir_tokens_sesion
from apps.identidad.infrastructure.auth.jwt_authentication import CookieJWTAuthentication
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.presentation.permissions import HasPermission

pytestmark = pytest.mark.django_db


@pytest.fixture
def escenario():
    cache.clear()
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'}
    )
    sexo = SexoModel.objects.create(sexo='M')
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='CONTRATADO', es_activo=True)
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='99000888',
        nombres='CACHE',
        apellidos='AUTH',
        sexoid=sexo,
        nacionalidad_id=1,
    )
    AsigTrabajoModel.objects.create(
        codigo='COD-AUTH',
        employee_id=empleado.cedulaidentidad,
        denominacioncargoid=cargo,
        denominacioncargoespecificoid=especifico,
        tiponominaid=nomina,
        estatusid=estatus,
    )
    rol = RolModel.objects.create(nombre_rol='ROL_CACHE_AUTH')
    permiso = PermisoModel.objects.create(codigo='personal.ver', nombre='Ver personal')
    RolPermisoModel.objects.create(rol_id=rol.pk, permiso=permiso)
    cuenta = CuentaModel.objects.create(cedula_id=empleado.cedulaidentidad, rol=rol)
    return cuenta, permiso


def _validated_token(cuenta: CuentaModel):
    version = RepoPermisosVersionORM().obtener(cuenta.pk)
    tokens = emitir_tokens_sesion(
        cuenta,
        str(cuenta.cedula_id),
        cuenta.rol.nombre_rol if cuenta.rol_id else None,
        version,
    )
    return CookieJWTAuthentication().get_validated_token(tokens.access)


def test_contexto_de_autenticacion_caliente_no_consulta_bd(escenario):
    cuenta, _ = escenario
    auth = CookieJWTAuthentication()
    validated = _validated_token(cuenta)

    with CaptureQueriesContext(connection) as frio:
        user = auth.get_user(validated)
    assert len(frio) <= 1
    assert user.cedula_id == str(cuenta.cedula_id)

    with CaptureQueriesContext(connection) as caliente:
        user2 = auth.get_user(validated)
    assert len(caliente) == 0, [q['sql'] for q in caliente.captured_queries]
    assert user2.is_active is True


def test_has_permission_no_consulta_bd_con_cache_caliente(escenario):
    cuenta, _ = escenario
    auth = CookieJWTAuthentication()
    validated = _validated_token(cuenta)
    user = auth.get_user(validated)
    request = APIRequestFactory().get('/')
    request.user = user
    permiso = HasPermission('personal.ver')()

    assert permiso.has_permission(request, None) is True  # calienta permisos
    with CaptureQueriesContext(connection) as caliente:
        assert permiso.has_permission(request, None) is True
    assert len(caliente) == 0, [q['sql'] for q in caliente.captured_queries]


def test_invalidar_contexto_obliga_a_la_siguiente_consulta(escenario):
    cuenta, _ = escenario
    auth = CookieJWTAuthentication()
    validated = _validated_token(cuenta)
    auth.get_user(validated)

    RepoCuentasORM().invalidar_contexto_cuenta(cuenta.pk)

    with CaptureQueriesContext(connection) as despues:
        auth.get_user(validated)
    assert len(despues) >= 1


def test_desactivar_cuenta_invalida_y_rechaza_la_siguiente_peticion(escenario):
    cuenta, _ = escenario
    auth = CookieJWTAuthentication()
    validated = _validated_token(cuenta)
    auth.get_user(validated)

    cuenta.is_active = False
    cuenta.save(update_fields=['is_active'])

    with pytest.raises(AuthenticationFailed):
        auth.get_user(validated)
