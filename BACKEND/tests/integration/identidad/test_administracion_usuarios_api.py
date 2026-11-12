"""
Integración (BD de pruebas) de la administración de usuarios y de la matriz de
permisos (D4): paginación y filtros, detalle con permiso efectivo, overrides,
matriz, reglas a)–g), permisos_version y auditoría.
"""
from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.models.password_inicial_model import (
    PasswordInicialModel,
)
from apps.identidad.infrastructure.models.permisos_version_model import (
    PermisosVersionModel,
)
from apps.identidad.infrastructure.models.usuario_permiso_model import (
    UsuarioPermisoModel,
)
from apps.identidad.application.use_cases.administrar_usuarios import contar_editores_matriz
from apps.identidad.infrastructure.repositories.repo_permisos_orm import RepoPermisosORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/identidad'
VER = 'identidad.ver_usuarios'
EDITAR = 'identidad.editar_usuarios'
MATRIZ = 'identidad.asignar_permisos'
OVERRIDES = 'identidad.gestionar_permisos_individuales'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=900, cedula='90000000', rol='ADMINISTRADOR', rol_id=1):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol_id = rol_id
        self.rol = SimpleNamespace(nombre_rol=rol)
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos, **kwargs):
    c = APIClient()
    c.force_authenticate(user=Usuario(permisos, **kwargs))
    return c


@pytest.fixture
def catalogo(db):
    from apps.catalogos.infrastructure.models.catalogo_models import (
        NacionalidadModel,
        SexoModel,
    )

    SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'}
    )
    for codigo, nombre in (
        (VER, 'Ver usuarios'),
        (EDITAR, 'Editar usuarios'),
        (MATRIZ, 'Editar la matriz'),
        (OVERRIDES, 'Gestionar overrides'),
        ('identidad.desactivar_usuarios', 'Desactivar usuarios'),
        ('identidad.crear_usuarios', 'Crear usuarios'),
        ('identidad.restablecer_acceso', 'Restablecer acceso'),
        ('identidad.cambiar_correo_acceso', 'Cambiar correo de acceso'),
        ('configuracion.editar', 'Editar configuración'),
        ('personal.corregir_cedula', 'Corregir cédula del trabajador'),
        ('personal.ver', 'Ver personal'),
    ):
        PermisoModel.objects.get_or_create(codigo=codigo, defaults={'nombre': nombre})


@pytest.fixture
def roles(db):
    RolModel.objects.get_or_create(id=1, defaults={'nombre_rol': 'ADMINISTRADOR'})
    RolModel.objects.get_or_create(id=2, defaults={'nombre_rol': 'ANALISTA'})
    RolModel.objects.get_or_create(id=3, defaults={'nombre_rol': 'AUTOGESTION'})


@pytest.fixture
def matriz(catalogo):
    for codigo in (
        MATRIZ,
        OVERRIDES,
        'identidad.crear_usuarios',
        'identidad.restablecer_acceso',
        'identidad.cambiar_correo_acceso',
        'configuracion.editar',
        'personal.corregir_cedula',
        EDITAR,
        VER,
    ):
        permiso = PermisoModel.objects.get(codigo=codigo)
        RolPermisoModel.objects.get_or_create(rol_id=1, permiso=permiso)
    return PermisoModel.objects.get(codigo=MATRIZ)


def cuenta(cedula, rol_id=3, nombres='ANA', apellidos='PRUEBA', correo=None, activa=True):
    empleado, _ = EmployeeModel.objects.get_or_create(
        cedulaidentidad=cedula,
        defaults={
            'nombres': nombres,
            'apellidos': apellidos,
            'correo': correo or f'{cedula}@conatel.gob.ve',
            'sexoid_id': 1,
        },
    )
    fila, creada = CuentaModel.objects.get_or_create(
        cedula=empleado, defaults={'rol_id': rol_id, 'is_active': activa}
    )
    if not creada:
        fila.rol_id = rol_id
        fila.is_active = activa
        fila.save()
    if not fila.password or not fila.check_password(cedula):
        fila.set_password(cedula)
        fila.save()
    PasswordInicialModel.objects.get_or_create(
        cuenta_id=fila.pk,
        defaults={
            'emitida_en': timezone.now(),
            'vence_en': timezone.now() + timedelta(days=1),
        },
    )
    return fila


# ─── Listado: paginación y filtros ───

def test_listado_pagina_en_servidor_con_tope(matriz, roles):
    for i in range(12):
        cuenta(f'300000{i:02d}', rol_id=3)
    api = cliente(VER)

    primera = api.get(f'{BASE}/usuarios/')
    datos = primera.json()['data']

    assert primera.status_code == 200
    assert datos['total'] == 12
    assert len(datos['resultados']) == 10
    assert datos['pagina'] == 1
    assert datos['total_paginas'] == 2

    segunda = api.get(f'{BASE}/usuarios/?pagina=2').json()['data']
    assert len(segunda['resultados']) == 2

    tope = api.get(f'{BASE}/usuarios/?page_size=999').json()['data']
    assert tope['tamano'] == 50


def test_listado_filtra_por_cedula_nombre_correo_rol_y_estado(matriz, roles):
    objetivo = cuenta('31111111', rol_id=2, nombres='MARIA', apellidos='GOMEZ')
    cuenta('32222222', rol_id=3, nombres='PEDRO', apellidos='LOPEZ', activa=False)
    api = cliente(VER)

    assert api.get(f'{BASE}/usuarios/?cedula=3111').json()['data']['total'] == 1
    assert api.get(f'{BASE}/usuarios/?nombre=MARIA').json()['data']['total'] == 1
    assert api.get(f'{BASE}/usuarios/?correo=3222').json()['data']['total'] == 1
    assert api.get(f'{BASE}/usuarios/?rol_id=2').json()['data']['total'] == 1
    inactivos = api.get(f'{BASE}/usuarios/?is_active=false').json()['data']
    assert inactivos['total'] == 1
    assert inactivos['resultados'][0]['cedula'] == '32222222'
    assert objetivo.cedula_id == '31111111'


def test_listado_filtra_por_condicion_activo_pasivo(matriz, roles, monkeypatch):
    cuenta('33111111', rol_id=3)
    cuenta('34222222', rol_id=3)
    monkeypatch.setattr(
        'apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm.'
        'RepoCondicionTrabajadorORM.cedulas_por_condicion',
        lambda self, condicion: {'33111111'} if condicion == 'ACTIVO' else {'34222222'},
    )
    monkeypatch.setattr(
        'apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm.'
        'RepoCondicionTrabajadorORM.condicion_por_cedula',
        lambda self, cedula: SimpleNamespace(value='ACTIVO' if cedula == '33111111' else 'PASIVO'),
    )
    api = cliente(VER)

    activos = api.get(f'{BASE}/usuarios/?condicion=ACTIVO').json()['data']
    pasivos = api.get(f'{BASE}/usuarios/?condicion=PASIVO').json()['data']

    assert [r['cedula'] for r in activos['resultados']] == ['33111111']
    assert [r['cedula'] for r in pasivos['resultados']] == ['34222222']


def test_listado_incluye_ultimo_acceso_y_password_inicial_pendiente_sin_departamento(matriz, roles):
    cuenta('35111111', rol_id=3)
    respuesta = cliente(VER).get(f'{BASE}/usuarios/')
    fila = respuesta.json()['data']['resultados'][0]

    assert 'departamento_id' not in fila
    assert 'ultimo_acceso' in fila
    assert fila['password_inicial_pendiente'] is True
    assert fila['rol_nombre'] == 'AUTOGESTION'


def test_listado_no_ejecuta_bcrypt_ni_barre_condiciones_completas(matriz, roles, monkeypatch):
    """El listado resuelve condición y contraseña inicial en la misma consulta.

    Regresión de rendimiento: antes se hacían dos barridos completos de cédulas
    y hasta dos `check_password` (bcrypt) por cuenta de la página.
    """
    cuenta('36111111', rol_id=3)

    def prohibido(*_args, **_kwargs):
        raise AssertionError('El listado no debe ejecutar esta consulta por fila.')

    monkeypatch.setattr(
        'apps.identidad.infrastructure.repositories.repo_cuentas_orm.RepoCuentasORM.verificar_password',
        prohibido,
    )
    monkeypatch.setattr(
        'apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm.'
        'RepoCondicionTrabajadorORM.cedulas_por_condicion',
        prohibido,
    )

    respuesta = cliente(VER).get(f'{BASE}/usuarios/')

    assert respuesta.status_code == 200
    fila = respuesta.json()['data']['resultados'][0]
    assert fila['password_inicial_pendiente'] is True
    assert fila['debe_cambiar_password'] is True
    assert fila['condicion'] in ('ACTIVO', 'PASIVO', 'SIN_ASIGNACION')


def test_un_usuario_sin_permiso_no_ve_el_listado(roles):
    assert cliente().get(f'{BASE}/usuarios/').status_code == 403


# ─── Detalle y permiso efectivo ───

def test_detalle_calcula_el_permiso_efectivo_en_servidor_y_el_deny_gana(matriz, roles):
    permiso = PermisoModel.objects.get(codigo='personal.ver')
    RolPermisoModel.objects.get_or_create(rol_id=2, permiso=permiso)
    fila = cuenta('36111111', rol_id=2)
    UsuarioPermisoModel.objects.create(
        cedula='36111111', permisos_custom={'allow': [], 'deny': ['personal.ver']}
    )

    respuesta = cliente(VER).get(f'{BASE}/usuarios/{fila.pk}/detalle/')

    assert respuesta.status_code == 200
    datos = respuesta.json()['data']
    assert 'personal.ver' in datos['permisos']['del_rol']
    assert datos['permisos']['deny'] == ['personal.ver']
    assert 'personal.ver' not in datos['permisos']['efectivos']
    assert 'departamento_id' not in datos


def test_las_respuestas_no_devuelven_hash_ni_tokens(matriz, roles):
    fila = cuenta('37111111', rol_id=3)
    api = cliente(VER)

    for respuesta in (api.get(f'{BASE}/usuarios/'), api.get(f'{BASE}/usuarios/{fila.pk}/detalle/')):
        cuerpo = respuesta.content.decode().lower()
        assert 'pbkdf2' not in cuerpo
        assert 'password_hash' not in cuerpo
        assert 'access_token' not in cuerpo
        assert 'refresh_token' not in cuerpo


# ─── Reglas a), b) y c) en la API ───

def test_a_nadie_desactiva_su_propia_cuenta(matriz, roles):
    fila = cuenta('38111111', rol_id=1)
    api = cliente('identidad.desactivar_usuarios', pk=fila.pk, cedula='38111111')

    respuesta = api.patch(
        f'{BASE}/usuarios/{fila.pk}/estado/',
        {'is_active': False, 'motivo': 'Quiero bloquear mi propia cuenta'},
        format='json',
    )

    assert respuesta.status_code == 403
    fila.refresh_from_db()
    assert fila.is_active is True
    assert AuditoriaLog.objects.filter(
        accion='identidad.estado_cuenta_actualizado', resultado='DENIED', recurso_id=str(fila.pk)
    ).exists()


def test_b_no_se_puede_quedar_sin_editores_de_la_matriz(matriz, roles):
    admin = cuenta('39111111', rol_id=1)
    cuenta('39222222', rol_id=2)
    api = cliente('identidad.desactivar_usuarios', pk=999, cedula='99999999')

    respuesta = api.patch(
        f'{BASE}/usuarios/{admin.pk}/estado/',
        {'is_active': False, 'motivo': 'Baja administrativa de prueba'},
        format='json',
    )

    assert respuesta.status_code == 409
    admin.refresh_from_db()
    assert admin.is_active is True


def test_b_tampoco_se_puede_degradar_al_ultimo_editor(matriz, roles):
    admin = cuenta('39333333', rol_id=1)
    cuenta('39444444', rol_id=2)
    api = cliente(EDITAR, pk=999, cedula='99999999')

    respuesta = api.patch(
        f'{BASE}/usuarios/{admin.pk}/',
        {'rol_id': 2, 'motivo': 'Cambio de funciones en la institución'},
        format='json',
    )

    assert respuesta.status_code == 409
    admin.refresh_from_db()
    assert admin.rol_id == 1


def test_c_nadie_se_cambia_su_propio_rol(matriz, roles):
    fila = cuenta('39555555', rol_id=1)
    api = cliente(EDITAR, pk=fila.pk, cedula='39555555')

    respuesta = api.patch(
        f'{BASE}/usuarios/{fila.pk}/',
        {'rol_id': 2, 'motivo': 'Quiero cambiarme el rol yo mismo'},
        format='json',
    )

    assert respuesta.status_code == 403
    fila.refresh_from_db()
    assert fila.rol_id == 1
    assert AuditoriaLog.objects.filter(
        accion='identidad.rol_actualizado', resultado='DENIED', recurso_id=str(fila.pk)
    ).exists()


def test_c_nadie_se_otorga_permisos_individuales(matriz, roles):
    fila = cuenta('39666666', rol_id=2)
    api = cliente(OVERRIDES, pk=fila.pk, cedula='39666666')

    respuesta = api.put(
        f'{BASE}/usuarios/{fila.pk}/permisos-individuales/',
        {'allow': ['identidad.asignar_permisos'], 'deny': [], 'motivo': 'Autoasignación indebida'},
        format='json',
    )

    assert respuesta.status_code == 403
    assert not UsuarioPermisoModel.objects.filter(cedula='39666666').exists()
    assert AuditoriaLog.objects.filter(
        accion='identidad.permisos_individuales_actualizados',
        resultado='DENIED',
        recurso_id=str(fila.pk),
    ).exists()


# ─── Overrides, auditoría y permisos_version ───

def test_los_overrides_se_guardan_auditan_y_suben_la_version(matriz, roles):
    fila = cuenta('40111111', rol_id=2)
    api = cliente(OVERRIDES, pk=999, cedula='99999999')
    antes = PermisosVersionModel.objects.filter(cuenta_id=fila.pk).values_list('version', flat=True).first() or 1

    respuesta = api.put(
        f'{BASE}/usuarios/{fila.pk}/permisos-individuales/',
        {
            'allow': ['personal.ver'],
            'deny': ['identidad.ver_usuarios'],
            'motivo': 'Excepción temporal aprobada por RRHH',
        },
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    datos = respuesta.json()['data']['permisos']
    assert datos['allow'] == ['personal.ver']
    assert datos['deny'] == ['identidad.ver_usuarios']
    assert PermisosVersionModel.objects.get(cuenta_id=fila.pk).version > antes
    registro = AuditoriaLog.objects.filter(
        accion='identidad.permisos_individuales_actualizados', recurso_id=str(fila.pk)
    ).latest('fecha_hora')
    assert registro.estado_nuevo['motivo'] == 'Excepción temporal aprobada por RRHH'
    assert registro.actor_cedula == '99999999'
    assert registro.ip_origen is not None


def test_el_override_debe_citar_permisos_del_catalogo(matriz, roles):
    fila = cuenta('40222222', rol_id=2)
    api = cliente(OVERRIDES, pk=999, cedula='99999999')

    respuesta = api.put(
        f'{BASE}/usuarios/{fila.pk}/permisos-individuales/',
        {'allow': ['no.existe'], 'deny': [], 'motivo': 'Prueba de código inexistente'},
        format='json',
    )

    assert respuesta.status_code == 400


# ─── Matriz de permisos ───

def test_la_matriz_se_lee_y_se_edita_con_auditoria_y_version(matriz, roles):
    fila = cuenta('41111111', rol_id=2)
    api = cliente(MATRIZ, VER, 'identidad.ver_roles', pk=999, cedula='99999999')

    lectura = api.get(f'{BASE}/roles/matriz/')
    assert lectura.status_code == 200
    assert any(f['codigo'] == MATRIZ for f in lectura.json()['data']['filas'])

    respuesta = api.put(
        f'{BASE}/roles/2/permisos/',
        {
            'permisos': [MATRIZ, VER],
            'motivo': 'El analista asume la administración de usuarios',
            'confirmar': True,
        },
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    assert PermisosVersionModel.objects.get(cuenta_id=fila.pk).version >= 2
    registro = AuditoriaLog.objects.filter(
        accion='identidad.matriz_permisos_actualizada', recurso_id='2'
    ).latest('fecha_hora')
    assert 'identidad.asignar_permisos' in registro.estado_nuevo['permisos']
    assert registro.estado_nuevo['motivo']


def test_la_matriz_exige_confirmacion_y_motivo(matriz, roles):
    api = cliente(MATRIZ, pk=999, cedula='99999999')

    sin_confirmar = api.put(
        f'{BASE}/roles/2/permisos/',
        {'permisos': [VER], 'motivo': 'Motivo suficientemente largo', 'confirmar': False},
        format='json',
    )
    sin_motivo = api.put(
        f'{BASE}/roles/2/permisos/',
        {'permisos': [VER], 'motivo': 'corto', 'confirmar': True},
        format='json',
    )

    assert sin_confirmar.status_code == 400
    assert sin_motivo.status_code == 400


def test_solo_quien_puede_editar_la_matriz_la_edita(matriz, roles):
    api = cliente(VER, EDITAR, pk=999, cedula='99999999')

    respuesta = api.put(
        f'{BASE}/roles/2/permisos/',
        {'permisos': [VER], 'motivo': 'Intento sin permiso de matriz', 'confirmar': True},
        format='json',
    )

    assert respuesta.status_code == 403


def test_la_matriz_no_puede_dejar_el_sistema_sin_editores(matriz, roles):
    cuenta('42111111', rol_id=1)
    api = cliente(MATRIZ, pk=999, cedula='99999999', rol_id=2)

    respuesta = api.put(
        f'{BASE}/roles/1/permisos/',
        {'permisos': [VER], 'motivo': 'Intento de retirar la matriz al último editor', 'confirmar': True},
        format='json',
    )

    assert respuesta.status_code == 409
    assert RolPermisoModel.objects.filter(
        rol_id=1, permiso__codigo=MATRIZ
    ).exists()
    assert AuditoriaLog.objects.filter(
        accion='identidad.matriz_permisos_actualizada', resultado='DENIED', recurso_id='1'
    ).exists()


def test_m5_contar_editores_no_carga_todas_las_cuentas(matriz, roles, django_assert_num_queries):
    """M5: el conteo usa consultas en bloque (cédula/rol, matriz y overrides)."""
    for i in range(25):
        cuenta(f'43{i:06d}', rol_id=3)
    cuenta('430000001', rol_id=1)

    with django_assert_num_queries(3):
        assert contar_editores_matriz(RepoPermisosORM()) == 1
