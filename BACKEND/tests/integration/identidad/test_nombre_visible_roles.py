"""
O43: nombre visible de los roles con código interno fijo.

- Llenado idempotente de los 10 nombres (sin pisar los editados).
- API de roles: crear genera el código; editar cambia solo la etiqueta.
- `/me`, matriz y detalle de usuario muestran la etiqueta y conservan el código.
- Cambiar un nombre visible no altera permisos, token ni acceso.
"""
from types import SimpleNamespace

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.identidad.application.use_cases.emitir_tokens_sesion import emitir_tokens_sesion
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.schema.nombres_visibles_roles import (
    NOMBRES_VISIBLES_ROLES,
    aplicar_nombres_visibles,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

BASE = '/api/v1/identidad'
URL_ME = f'{BASE}/auth/me/'

# Códigos tal como están en la base real (incluida la errata histórica del rol 5).
CODIGOS_REALES = (
    'ADMINISTRADOR', 'ANALISTA', 'AUTOGESTION', 'PRESUPUESTO', 'BIENSTAR SOCIAL',
    'ANALISTA_BIENESTAR', 'ADMIN_BIENESTAR', 'AUDITOR', 'JEFE_RRHH', 'RECEPCIONISTA',
)
VISIBLES_ESPERADOS = (
    'Administrador', 'Analista', 'Autogestión', 'Presupuesto', 'Bienestar Social',
    'Analista de Bienestar', 'Administrador de Bienestar', 'Auditor', 'Jefe de RRHH',
    'Recepcionista',
)


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=900, cedula='90000000'):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol_id = 1
        self.rol = SimpleNamespace(nombre_rol='ADMINISTRADOR')
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def _crear_roles_reales():
    return [RolModel.objects.create(nombre_rol=c) for c in CODIGOS_REALES]


# ─── Llenado de datos (migración y seed) ───

def test_llena_los_diez_nombres_visibles_incluida_la_errata_de_bienestar():
    _crear_roles_reales()

    llenados = aplicar_nombres_visibles(connection)

    assert llenados == 10
    visibles = tuple(
        RolModel.objects.get(nombre_rol=c).nombre_visible for c in CODIGOS_REALES
    )
    assert visibles == VISIBLES_ESPERADOS
    assert len(NOMBRES_VISIBLES_ROLES) == 10


def test_el_llenado_es_idempotente_y_no_pisa_un_nombre_editado():
    _crear_roles_reales()
    aplicar_nombres_visibles(connection)
    RolModel.objects.filter(nombre_rol='ANALISTA').update(nombre_visible='Analista de Presupuesto')

    segundo = aplicar_nombres_visibles(connection)

    assert segundo == 0
    assert RolModel.objects.get(nombre_rol='ANALISTA').nombre_visible == 'Analista de Presupuesto'


def test_el_llenado_no_toca_el_codigo_ni_roles_desconocidos():
    RolModel.objects.create(nombre_rol='ROL_PERSONALIZADO')
    RolModel.objects.create(nombre_rol='AUDITOR', nombre_visible='   ')

    aplicar_nombres_visibles(connection)

    assert RolModel.objects.get(nombre_rol='ROL_PERSONALIZADO').nombre_visible in (None, '')
    auditor = RolModel.objects.get(nombre_rol='AUDITOR')
    assert (auditor.nombre_rol, auditor.nombre_visible) == ('AUDITOR', 'Auditor')


# ─── API del catálogo ───

def test_crear_rol_genera_el_codigo_una_sola_vez_y_guarda_el_nombre_visible():
    api = _cliente('identidad.crear_roles')

    respuesta = api.post(
        f'{BASE}/roles/', {'nombre_visible': 'Coordinación de Pasivos'}, format='json'
    )

    assert respuesta.status_code == 201, respuesta.content
    datos = respuesta.json()['data']
    assert datos['nombre_rol'] == 'COORDINACION_DE_PASIVOS'
    assert datos['nombre_visible'] == 'Coordinación de Pasivos'


def test_editar_rol_cambia_la_etiqueta_pero_no_el_codigo():
    rol = RolModel.objects.create(nombre_rol='ANALISTA', nombre_visible='Analista')
    api = _cliente('identidad.editar_roles')

    respuesta = api.patch(
        f'{BASE}/roles/{rol.pk}/',
        {'nombre_visible': 'Analista de Nómina', 'descripcion_rol': 'Gestiona la nómina'},
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    rol.refresh_from_db()
    assert (rol.nombre_rol, rol.nombre_visible) == ('ANALISTA', 'Analista de Nómina')
    assert respuesta.json()['data']['nombre_rol'] == 'ANALISTA'


def test_editar_rol_rechaza_cambiar_el_codigo_interno():
    rol = RolModel.objects.create(nombre_rol='ANALISTA', nombre_visible='Analista')
    api = _cliente('identidad.editar_roles')

    respuesta = api.patch(
        f'{BASE}/roles/{rol.pk}/',
        {'nombre_rol': 'OTRO_CODIGO', 'nombre_visible': 'Otro'},
        format='json',
    )

    assert respuesta.status_code == 400
    rol.refresh_from_db()
    assert (rol.nombre_rol, rol.nombre_visible) == ('ANALISTA', 'Analista')


def test_listado_de_roles_expone_codigo_y_nombre_visible():
    RolModel.objects.create(nombre_rol='JEFE_RRHH', nombre_visible='Jefe de RRHH')
    RolModel.objects.create(nombre_rol='SIN_ETIQUETA')
    api = _cliente('identidad.ver_roles')

    filas = {f['nombre_rol']: f for f in api.get(f'{BASE}/roles/').json()['data']}

    assert filas['JEFE_RRHH']['nombre_visible'] == 'Jefe de RRHH'
    assert filas['SIN_ETIQUETA']['nombre_visible'] == 'SIN_ETIQUETA'


def test_la_matriz_trae_el_nombre_visible_de_cada_columna():
    RolModel.objects.create(nombre_rol='AUDITOR', nombre_visible='Auditor')
    api = _cliente('identidad.ver_roles', 'identidad.asignar_permisos')

    respuesta = api.get(f'{BASE}/roles/matriz/')

    assert respuesta.status_code == 200, respuesta.content
    columna = next(r for r in respuesta.json()['data']['roles'] if r['nombre'] == 'AUDITOR')
    assert columna['nombre_visible'] == 'Auditor'


# ─── Acceso intacto al renombrar ───

@pytest.fixture
def cuenta_con_rol():
    from apps.catalogos.infrastructure.models.catalogo_models import (
        NacionalidadModel,
        SexoModel,
    )

    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='M')
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='99000043', nombres='ROL', apellidos='VISIBLE',
        sexoid=sexo, nacionalidad_id=1,
    )
    rol = RolModel.objects.create(nombre_rol='ANALISTA', nombre_visible='Analista')
    permiso = PermisoModel.objects.create(codigo='personal.ver', nombre='Ver personal')
    RolPermisoModel.objects.create(rol_id=rol.pk, permiso=permiso)
    cuenta = CuentaModel.objects.create(cedula_id=empleado.cedulaidentidad, rol=rol)
    return cuenta, rol


def _api_sesion(cuenta):
    version = RepoPermisosVersionORM().obtener(cuenta.pk)
    tokens = emitir_tokens_sesion(
        cuenta, str(cuenta.cedula_id), cuenta.rol.nombre_rol, version
    )
    api = APIClient()
    api.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens.access}')
    return api, tokens


def test_renombrar_el_rol_no_cambia_token_permisos_ni_acceso(cuenta_con_rol):
    cuenta, rol = cuenta_con_rol
    api, tokens = _api_sesion(cuenta)
    antes = api.get(URL_ME).json()['data']
    assert antes['rol_nombre'] == 'ANALISTA'
    assert antes['rol_nombre_visible'] == 'Analista'

    editor = _cliente('identidad.editar_roles')
    assert editor.patch(
        f'{BASE}/roles/{rol.pk}/', {'nombre_visible': 'Analista Principal'}, format='json'
    ).status_code == 200

    # El mismo token sigue valido: renombrar no sube permisos_version.
    despues_resp = api.get(URL_ME)
    assert despues_resp.status_code == 200
    despues = despues_resp.json()['data']
    assert despues['permisos'] == antes['permisos'] == ['personal.ver']
    assert despues['rol_nombre'] == 'ANALISTA'
    assert despues['rol_id'] == antes['rol_id']
    assert despues['rol_nombre_visible'] == 'Analista Principal'

    # El claim `rol` del token sigue siendo el código.
    from rest_framework_simplejwt.tokens import AccessToken

    assert AccessToken(tokens.access)['rol'] == 'ANALISTA'
    assert RepoPermisosVersionORM().obtener(cuenta.pk) == 1


def test_detalle_de_usuario_trae_la_etiqueta_del_rol(cuenta_con_rol):
    cuenta, _rol = cuenta_con_rol
    api = _cliente('identidad.ver_usuarios')

    respuesta = api.get(f'{BASE}/usuarios/{cuenta.pk}/detalle/')

    assert respuesta.status_code == 200, respuesta.content
    datos = respuesta.json()['data']
    assert datos['rol_nombre'] == 'ANALISTA'
    assert datos['rol_nombre_visible'] == 'Analista'
    assert datos['permisos']['rol_nombre_visible'] == 'Analista'


# ─── Correcciones de auditoría de O43 ───

def _quitar_columna_nombre_visible():
    with connection.cursor() as cursor:
        cursor.execute('ALTER TABLE "USER_rol" DROP COLUMN IF EXISTS "nombre_visible"')


def _columna_existe() -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM information_schema.columns WHERE table_name = 'USER_rol' "
            "AND column_name = 'nombre_visible' AND table_schema = current_schema()"
        )
        return cursor.fetchone() is not None


def test_migrate_desde_antes_de_0010_el_seed_corre_sin_la_columna_y_0011_la_deja_lista():
    """`identidad.0010` ejecuta el seed ANTES de que `0011` cree la columna."""
    import importlib

    from django.core.management import call_command

    migracion_0010 = importlib.import_module(
        'apps.identidad.migrations.0010_seed_permisos_final'
    )
    migracion_0011 = importlib.import_module(
        'apps.identidad.migrations.0011_nombre_visible_rol'
    )
    _quitar_columna_nombre_visible()
    assert not _columna_existe()

    migracion_0010.aplicar_seed_final(None, None)  # lo que hace migrate en 0010

    assert _columna_existe()
    assert RolModel.objects.filter(nombre_rol='RECEPCIONISTA').exists()
    migracion_0011._aplicar(None, SimpleNamespace(connection=connection))  # 0011 es idempotente
    visibles = dict(RolModel.objects.values_list('nombre_rol', 'nombre_visible'))
    assert visibles['RECEPCIONISTA'] == 'Recepcionista'
    assert visibles['AUDITOR'] == 'Auditor'
    assert visibles['JEFE_RRHH'] == 'Jefe de RRHH'
    assert visibles['ADMIN_BIENESTAR'] == 'Administrador de Bienestar'
    call_command('seed_permisos')  # segunda corrida: sin errores ni cambios de nombre
    assert RolModel.objects.get(nombre_rol='AUDITOR').nombre_visible == 'Auditor'


def test_el_nombre_visible_no_puede_repetir_el_codigo_de_un_rol_sin_etiqueta():
    RolModel.objects.create(nombre_rol='ROL_PERSONALIZADO')
    api = _cliente('identidad.crear_roles')

    respuesta = api.post(f'{BASE}/roles/', {'nombre_visible': 'rol_personalizado'}, format='json')

    assert respuesta.status_code == 409, respuesta.content


def test_alta_simultanea_que_choca_en_la_base_responde_409(monkeypatch):
    from django.db import IntegrityError

    def _choque(*args, **kwargs):
        raise IntegrityError('duplicate key value violates unique constraint')

    monkeypatch.setattr(RolModel.objects, 'create', _choque)
    api = _cliente('identidad.crear_roles')

    respuesta = api.post(f'{BASE}/roles/', {'nombre_visible': 'Rol Concurrente'}, format='json')

    assert respuesta.status_code == 409, respuesta.content


def test_la_bitacora_muestra_el_nombre_visible_del_rol_y_conserva_el_codigo():
    from core.infrastructure.models.auditoria import AuditoriaLog

    RolModel.objects.create(nombre_rol='ANALISTA', nombre_visible='Analista')
    AuditoriaLog.objects.create(
        trace_id='t', actor_id=1, actor_cedula='V1', actor_rol='ANALISTA', modulo='personal',
        accion='personal.editar', recurso_tipo='Employee', recurso_id='1',
        ip_origen='10.0.0.1', user_agent='x', resultado='SUCCESS',
    )
    api = _cliente('auditoria.ver_logs')

    fila = api.get('/api/v1/auditoria/').json()['data']['resultados'][0]

    assert fila['actor_rol'] == 'ANALISTA'
    assert fila['actor_rol_visible'] == 'Analista'
    assert AuditoriaLog.objects.get().actor_rol == 'ANALISTA'
