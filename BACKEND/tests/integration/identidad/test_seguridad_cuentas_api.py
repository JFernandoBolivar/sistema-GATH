"""
Integración con permisos reales (HasPermission + motor IAM) de las
correcciones de seguridad A1, A2, M2, M3 y M4.
"""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.identidad.domain.services.reglas_administracion import PERMISOS_ADMINISTRACION
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.models.permisos_version_model import (
    PermisosVersionModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/identidad'
MOTIVO = 'Motivo suficientemente largo para la auditoría'
VER = 'identidad.ver_usuarios'
EDITAR = 'identidad.editar_usuarios'
DESACTIVAR = 'identidad.desactivar_usuarios'


@pytest.fixture
def base(db):
    SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'}
    )
    for codigo in (
        *PERMISOS_ADMINISTRACION,
        VER,
        EDITAR,
        DESACTIVAR,
        'autogestion.ver_propio',
    ):
        PermisoModel.objects.get_or_create(codigo=codigo, defaults={'nombre': codigo})
    RolModel.objects.get_or_create(id=1, defaults={'nombre_rol': 'ADMINISTRADOR'})
    RolModel.objects.get_or_create(id=2, defaults={'nombre_rol': 'ANALISTA'})
    RolModel.objects.get_or_create(id=3, defaults={'nombre_rol': 'AUTOGESTION'})

    codigos_por_rol = {
        1: {*PERMISOS_ADMINISTRACION, VER, EDITAR, DESACTIVAR},
        2: {VER, EDITAR, 'identidad.restablecer_acceso', 'identidad.cambiar_correo_acceso'},
        3: {'autogestion.ver_propio'},
    }
    for rol_id, codigos in codigos_por_rol.items():
        for codigo in codigos:
            RolPermisoModel.objects.get_or_create(
                rol_id=rol_id, permiso=PermisoModel.objects.get(codigo=codigo)
            )


def cuenta(cedula, rol_id, nombres='PRUEBA', correo=None, activa=True):
    empleado = EmployeeModel.objects.create(
        cedulaidentidad=cedula,
        nombres=nombres,
        apellidos='SEGURIDAD',
        sexoid_id=1,
        correo=correo or f'{cedula}@conatel.gob.ve',
    )
    fila = CuentaModel.objects.create_user(
        cedula=empleado, password=cedula, rol_id=rol_id
    )
    if not activa:
        fila.is_active = False
        fila.save()
    return fila


def api(cuenta_actor):
    cliente = APIClient()
    cliente.force_authenticate(user=cuenta_actor)
    return cliente


# ─── A1: restablecer acceso ───

def test_a1_un_analista_no_restablece_el_acceso_de_un_administrador(base):
    analista = cuenta('51000001', 2)
    admin = cuenta('51000002', 1)

    respuesta = api(analista).post(
        f'{BASE}/usuarios/{admin.pk}/restablecer-acceso/', {'motivo': MOTIVO}, format='json'
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.acceso_restablecido', resultado='DENIED', recurso_id=str(admin.pk)
    ).exists()


def test_a1_un_analista_si_restablece_el_acceso_de_una_cuenta_basica(base):
    analista = cuenta('51000003', 2)
    basica = cuenta('51000004', 3)

    respuesta = api(analista).post(
        f'{BASE}/usuarios/{basica.pk}/restablecer-acceso/', {'motivo': MOTIVO}, format='json'
    )

    assert respuesta.status_code == 200, respuesta.content
    assert AuditoriaLog.objects.filter(
        accion='identidad.acceso_restablecido', resultado='SUCCESS', recurso_id=str(basica.pk)
    ).exists()
    # El motivo queda en la auditoría y nunca la contraseña.
    registro = AuditoriaLog.objects.filter(recurso_id=str(basica.pk)).latest('fecha_hora')
    assert registro.estado_nuevo['motivo'] == MOTIVO
    assert 'password' not in registro.estado_nuevo


# ─── A2: cambiar correo de acceso ───

def test_a2_un_analista_no_cambia_el_correo_de_un_administrador(base):
    analista = cuenta('52000001', 2)
    admin = cuenta('52000002', 1, correo='admin.correo@conatel.gob.ve')

    respuesta = api(analista).post(
        f'{BASE}/cuentas/{admin.cedula_id}/correo-acceso/',
        {'fuente': 'INSTITUCIONAL', 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.correo_acceso_cambiado',
        resultado='DENIED',
        recurso_id=str(admin.cedula_id),
    ).exists()


def test_a2_un_analista_si_cambia_el_correo_de_una_cuenta_basica(base):
    analista = cuenta('52000003', 2)
    basica = cuenta('52000004', 3, correo='basica.correo@conatel.gob.ve')

    respuesta = api(analista).post(
        f'{BASE}/cuentas/{basica.cedula_id}/correo-acceso/',
        {'fuente': 'INSTITUCIONAL', 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    registro = AuditoriaLog.objects.filter(
        accion='identidad.correo_acceso_cambiado', recurso_id=str(basica.cedula_id)
    ).latest('fecha_hora')
    assert registro.estado_nuevo['motivo'] == MOTIVO
    assert registro.estado_previo['correo'] == 'basica.correo@conatel.gob.ve'


# ─── M3: asignación de roles ───

def test_m3_un_analista_no_asigna_el_rol_administrador(base):
    analista = cuenta('53000001', 2)
    objetivo = cuenta('53000002', 3)

    respuesta = api(analista).patch(
        f'{BASE}/usuarios/{objetivo.pk}/',
        {'rol_id': 1, 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.rol_actualizado', resultado='DENIED', recurso_id=str(objetivo.pk)
    ).exists()


def test_m3_un_administrador_si_asigna_el_rol_administrador(base):
    admin = cuenta('53000003', 1)
    objetivo = cuenta('53000004', 3)

    respuesta = api(admin).patch(
        f'{BASE}/usuarios/{objetivo.pk}/',
        {'rol_id': 1, 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content


def test_m3_un_rol_inexistente_da_400(base):
    admin = cuenta('53000005', 1)
    objetivo = cuenta('53000006', 3)

    respuesta = api(admin).patch(
        f'{BASE}/usuarios/{objetivo.pk}/',
        {'rol_id': 99999, 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 400


# ─── M4: matriz del propio rol ───

def test_m4_un_administrador_no_modifica_la_matriz_de_su_propio_rol(base):
    admin = cuenta('54000001', 1)

    respuesta = api(admin).put(
        f'{BASE}/roles/1/permisos/',
        {
            'permisos': [VER],
            'motivo': MOTIVO,
            'confirmar': True,
        },
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.matriz_permisos_actualizada',
        resultado='DENIED',
        recurso_id='1',
    ).exists()


def test_m4_un_administrador_si_modifica_la_matriz_de_otro_rol(base):
    admin = cuenta('54000002', 1)

    respuesta = api(admin).put(
        f'{BASE}/roles/2/permisos/',
        {
            'permisos': [VER, EDITAR],
            'motivo': MOTIVO,
            'confirmar': True,
        },
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content


# ─── M2: la contraseña no se cambia por el PATCH de usuarios ───

def test_m2_el_patch_de_usuario_rechaza_password(base):
    admin = cuenta('55000001', 1)
    objetivo = cuenta('55000002', 3)

    respuesta = api(admin).patch(
        f'{BASE}/usuarios/{objetivo.pk}/',
        {'password': 'OtraClave*2026'},
        format='json',
    )

    assert respuesta.status_code == 400
    objetivo.refresh_from_db()
    assert objetivo.check_password('55000002')


def test_m2_establecer_password_invalida_las_sesiones(base):
    admin = cuenta('55000003', 1)
    objetivo = cuenta('55000004', 3)
    antes = PermisosVersionModel.objects.filter(cuenta_id=objetivo.pk).values_list(
        'version', flat=True
    ).first() or 1

    respuesta = api(admin).post(
        f'{BASE}/usuarios/{objetivo.pk}/restablecer-acceso/', {'motivo': MOTIVO}, format='json'
    )

    assert respuesta.status_code == 200
    assert PermisosVersionModel.objects.get(cuenta_id=objetivo.pk).version > antes
# ─── Ronda 2: escalada lateral por matriz/overrides y cuentas administrativas ───

def _agregar_permisos_rol(rol_id, codigos):
    for codigo in codigos:
        RolPermisoModel.objects.get_or_create(
            rol_id=rol_id, permiso=PermisoModel.objects.get(codigo=codigo)
        )


def test_r2_la_matriz_no_permite_conceder_un_admin_que_el_actor_no_tiene(base):
    actor = cuenta('57000001', 2)
    _agregar_permisos_rol(2, ['identidad.asignar_permisos'])

    respuesta = api(actor).put(
        f'{BASE}/roles/3/permisos/',
        {
            'permisos': ['autogestion.ver_propio', 'configuracion.editar'],
            'motivo': MOTIVO,
            'confirmar': True,
        },
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.matriz_permisos_actualizada',
        resultado='DENIED',
        recurso_id='3',
    ).exists()
    assert not RolPermisoModel.objects.filter(
        rol_id=3, permiso__codigo='configuracion.editar'
    ).exists()


def test_r2_un_administrador_completo_si_concede_configuracion_en_la_matriz(base):
    admin = cuenta('57000002', 1)

    respuesta = api(admin).put(
        f'{BASE}/roles/3/permisos/',
        {
            'permisos': ['autogestion.ver_propio', 'configuracion.editar'],
            'motivo': MOTIVO,
            'confirmar': True,
        },
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    assert RolPermisoModel.objects.filter(
        rol_id=3, permiso__codigo='configuracion.editar'
    ).exists()


def test_r2_un_allow_individual_no_puede_conceder_un_admin_que_el_actor_no_tiene(base):
    actor = cuenta('57000003', 2)
    objetivo = cuenta('57000004', 3)
    _agregar_permisos_rol(2, ['identidad.gestionar_permisos_individuales'])

    respuesta = api(actor).put(
        f'{BASE}/usuarios/{objetivo.pk}/permisos-individuales/',
        {'allow': ['configuracion.editar'], 'deny': [], 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.permisos_individuales_actualizados',
        resultado='DENIED',
        recurso_id=str(objetivo.pk),
    ).exists()


def test_r2_un_administrador_completo_si_concede_un_allow_individual(base):
    admin = cuenta('57000005', 1)
    objetivo = cuenta('57000006', 3)

    respuesta = api(admin).put(
        f'{BASE}/usuarios/{objetivo.pk}/permisos-individuales/',
        {'allow': ['configuracion.editar'], 'deny': [], 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content


def test_r2_solo_un_administrador_completo_cambia_el_rol_de_otro_admin(base):
    actor = cuenta('57000007', 2)
    admin = cuenta('57000008', 1)

    respuesta = api(actor).patch(
        f'{BASE}/usuarios/{admin.pk}/',
        {'rol_id': 3, 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.rol_actualizado',
        resultado='DENIED',
        recurso_id=str(admin.pk),
    ).exists()


def test_r2_solo_un_administrador_completo_desactiva_a_otro_admin(base):
    actor = cuenta('57000009', 2)
    admin = cuenta('57000010', 1)
    _agregar_permisos_rol(2, ['identidad.desactivar_usuarios'])

    respuesta = api(actor).patch(
        f'{BASE}/usuarios/{admin.pk}/estado/',
        {'is_active': False, 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.estado_cuenta_actualizado',
        resultado='DENIED',
        recurso_id=str(admin.pk),
    ).exists()


def test_r2_solo_un_administrador_completo_pone_deny_a_otro_admin(base):
    actor = cuenta('57000011', 2)
    admin = cuenta('57000012', 1)
    _agregar_permisos_rol(2, ['identidad.gestionar_permisos_individuales'])

    respuesta = api(actor).put(
        f'{BASE}/usuarios/{admin.pk}/permisos-individuales/',
        {'allow': [], 'deny': ['personal.ver'], 'motivo': MOTIVO},
        format='json',
    )

    assert respuesta.status_code == 403
    assert AuditoriaLog.objects.filter(
        accion='identidad.permisos_individuales_actualizados',
        resultado='DENIED',
        recurso_id=str(admin.pk),
    ).exists()
