"""
Integración (BD de pruebas) del ciclo de vida de las cuentas (decisión F, D8): login con la contraseña
inicial vigente/vencida, alta automática al cargar el correo, «Restablecer acceso», aviso por correo al
cambiar la contraseña, correo de acceso y desactivación por egreso (señal de movimientos de cargos).
"""
import copy
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.actualizacion_models import (
    DatosComplementariosTrabajadorModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.domain.services.politica_password_inicial import (
    MENSAJE_PASSWORD_INICIAL_VENCIDA,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
from apps.identidad.infrastructure.receivers import ciclo_de_vida_por_movimiento
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

URL_LOGIN = '/api/v1/identidad/auth/login/'
BASE = '/api/v1/identidad'
CEDULA = '20111234'
CORREO = 'ana.prueba@conatel.gob.ve'
FUERTE = 'Clave*Nueva2026'


@pytest.fixture(autouse=True)
def entorno(settings):
    settings.CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'test-ciclo'}}
    cache.clear()
    configuracion = copy.deepcopy(settings.REST_FRAMEWORK)
    configuracion['DEFAULT_THROTTLE_RATES']['login'] = '1000/min'
    settings.REST_FRAMEWORK = configuracion
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
    settings.DOMINIO_CORREO_INSTITUCIONAL = 'conatel.gob.ve'


@pytest.fixture
def condicion(monkeypatch):
    """La condición ACTIVO/PASIVO depende de AsigTrabajo (catálogos pesados): se fija por cédula."""
    tabla = {}

    def _por_cedula(self, cedula):
        return tabla.get(str(cedula), CondicionTrabajador.SIN_ASIGNACION)

    monkeypatch.setattr(
        'apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm.'
        'RepoCondicionTrabajadorORM.condicion_por_cedula', _por_cedula,
    )
    return tabla


@pytest.fixture
def base(db):
    SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    RolModel.objects.get_or_create(id=3, defaults={'nombre_rol': 'AUTOGESTION'})


def empleado(cedula=CEDULA, correo=CORREO):
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='ANA', apellidos='PRUEBA', sexoid_id=1, correo=correo
    )


def cuenta_con_cedula(cedula=CEDULA, correo=CORREO, vence_en=None):
    emp = empleado(cedula, correo)
    cuenta = CuentaModel.objects.create_user(cedula=emp, password=cedula, rol_id=3)
    if vence_en is not None:
        PasswordInicialModel.objects.create(cuenta_id=cuenta.pk, emitida_en=timezone.now(), vence_en=vence_en)
    return cuenta


def login(correo, password):
    return APIClient().post(URL_LOGIN, {'correo': correo, 'password': password}, format='json')


class Usuario:
    """Actor con permisos fijos (la matriz real se prueba en los tests de permisos)."""
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=999):
        self.pk = self.id = pk
        self.cedula_id = '10000000'
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente_con(*permisos):
    c = APIClient()
    c.force_authenticate(user=Usuario(permisos))
    return c


# ─── Login con contraseña inicial ───

def test_login_con_la_cedula_vigente_entra_y_exige_cambio(base):
    cuenta = cuenta_con_cedula(vence_en=timezone.now() + timedelta(days=3))

    r = login(CORREO, CEDULA)

    assert r.status_code == 200
    c = APIClient()
    c.force_authenticate(user=cuenta)
    assert c.get(f'{BASE}/auth/me/').json()['data']['debe_cambiar_password'] is True


def test_login_con_contrasena_inicial_vencida_responde_error_claro(base):
    cuenta_con_cedula(vence_en=timezone.now() - timedelta(minutes=1))

    r = login(CORREO, CEDULA)

    assert r.status_code == 401
    assert r.json()['message'] == MENSAJE_PASSWORD_INICIAL_VENCIDA


def test_contrasena_inicial_vencida_no_revela_estado_si_la_clave_es_otra(base):
    cuenta_con_cedula(vence_en=timezone.now() - timedelta(days=1))

    r = login(CORREO, 'otra-clave')

    assert r.status_code == 401
    assert r.json()['message'] == 'Credenciales inválidas.'


def test_cuenta_sin_fila_de_vencimiento_no_vence(base):
    cuenta_con_cedula(vence_en=None)  # cuentas anteriores a D8

    assert login(CORREO, CEDULA).status_code == 200


# ─── Alta automática ───

def test_alta_automatica_del_activo_al_cargar_correo_institucional(base, condicion):
    condicion['20999001'] = CondicionTrabajador.ACTIVO

    empleado('20999001', None)  # aún sin correo: no hay cuenta
    assert not CuentaModel.objects.filter(cedula_id='20999001').exists()

    emp = EmployeeModel.objects.get(cedulaidentidad='20999001')
    emp.correo = 'luis.gomez@conatel.gob.ve'
    emp.save()

    cuenta = CuentaModel.objects.get(cedula_id='20999001')
    assert cuenta.rol_id == 3 and cuenta.is_active
    assert cuenta.check_password('20999001')
    assert PasswordInicialModel.objects.get(cuenta_id=cuenta.pk).vence_en > timezone.now() + timedelta(days=6)
    assert NotificacionModel.objects.filter(destinatario_cedula='20999001', tipo='identidad.cuenta_creada').exists()
    assert EventoOutboxModel.objects.filter(destinatario='luis.gomez@conatel.gob.ve').exists()
    assert login('luis.gomez@conatel.gob.ve', '20999001').status_code == 200


def test_activo_con_correo_ajeno_al_dominio_no_recibe_cuenta(base, condicion):
    condicion['20999002'] = CondicionTrabajador.ACTIVO

    empleado('20999002', 'luis@gmail.com')

    assert not CuentaModel.objects.filter(cedula_id='20999002').exists()


def test_pasivo_recibe_cuenta_con_cualquier_correo_y_no_se_duplica(base, condicion):
    condicion['20999003'] = CondicionTrabajador.PASIVO

    emp = empleado('20999003', 'maria@gmail.com')
    emp.nombres = 'MARIA'
    emp.save()  # segundo guardado: no duplica

    assert CuentaModel.objects.filter(cedula_id='20999003').count() == 1


# ─── Restablecer acceso ───

def test_restablecer_acceso_repone_la_cedula_con_siete_dias_y_revoca_sesiones(base):
    cuenta = cuenta_con_cedula(vence_en=timezone.now() - timedelta(days=10))
    cuenta.set_password(FUERTE)
    cuenta.save()
    version_antes = RepoPermisosVersionORM().obtener(cuenta.pk)

    r = cliente_con('identidad.restablecer_acceso').post(f'{BASE}/usuarios/{cuenta.pk}/restablecer-acceso/')

    assert r.status_code == 200, r.content
    assert r.json()['data']['debe_cambiar_password'] is True
    cuenta.refresh_from_db()
    assert cuenta.check_password(CEDULA)
    assert PasswordInicialModel.objects.get(cuenta_id=cuenta.pk).vence_en > timezone.now() + timedelta(days=6)
    assert RepoPermisosVersionORM().obtener(cuenta.pk) == version_antes + 1
    assert NotificacionModel.objects.filter(destinatario_cedula=CEDULA, tipo='identidad.password_cambiada').exists()
    assert login(CORREO, CEDULA).status_code == 200  # ya no está vencida


def test_restablecer_acceso_exige_permiso(base):
    cuenta = cuenta_con_cedula()

    r = cliente_con('identidad.ver_usuarios').post(f'{BASE}/usuarios/{cuenta.pk}/restablecer-acceso/')

    assert r.status_code == 403


# ─── Aviso al cambiar la contraseña ───

def test_cambio_obligatorio_limpia_el_vencimiento_y_avisa(base):
    cuenta = cuenta_con_cedula(vence_en=timezone.now() + timedelta(days=2))
    c = APIClient()
    c.force_authenticate(user=cuenta)

    r = c.post(f'{BASE}/auth/cambiar-password/', {'password_actual': CEDULA, 'password_nuevo': FUERTE}, format='json')

    assert r.status_code == 200, r.content
    assert not PasswordInicialModel.objects.filter(cuenta_id=cuenta.pk).exists()
    aviso = NotificacionModel.objects.get(destinatario_cedula=CEDULA, tipo='identidad.password_cambiada')
    assert 'primer ingreso' in aviso.mensaje
    assert EventoOutboxModel.objects.filter(destinatario=CORREO, tipo='identidad.password_cambiada').exists()


def test_dos_cambios_seguidos_generan_dos_avisos(base):
    cuenta = cuenta_con_cedula()
    c = APIClient()
    c.force_authenticate(user=cuenta)

    c.post(f'{BASE}/auth/cambiar-password/', {'password_actual': CEDULA, 'password_nuevo': FUERTE}, format='json')
    c.post(f'{BASE}/auth/cambiar-password/', {'password_actual': FUERTE, 'password_nuevo': FUERTE + '9'}, format='json')

    assert EventoOutboxModel.objects.filter(destinatario=CORREO, tipo='identidad.password_cambiada').count() == 2


# ─── Correo de acceso ───

def test_correo_acceso_alternativo_actualiza_employee_crea_cuenta_del_pasivo_y_avisa(base, condicion):
    condicion[CEDULA] = CondicionTrabajador.PASIVO
    emp = empleado(CEDULA, 'ana@gmail.com')  # el pasivo ya fue dado de alta con un correo; ya tiene cuenta
    CuentaModel.objects.filter(cedula_id=CEDULA).delete()
    DatosComplementariosTrabajadorModel.objects.create(cedula=CEDULA, correo_alternativo='ana.alt@hotmail.com')
    EventoOutboxModel.objects.all().delete()
    NotificacionModel.objects.all().delete()

    r = cliente_con('identidad.cambiar_correo_acceso').post(
        f'{BASE}/cuentas/{CEDULA}/correo-acceso/', {'fuente': 'ALTERNATIVO'}, format='json'
    )

    assert r.status_code == 200, r.content
    emp.refresh_from_db()
    assert emp.correo == 'ana.alt@hotmail.com'
    assert CuentaModel.objects.filter(cedula_id=CEDULA).count() == 1
    assert EventoOutboxModel.objects.filter(destinatario='ana.alt@hotmail.com').count() == 1


def test_correo_acceso_con_cuenta_existente_avisa_al_correo_elegido(base):
    cuenta_con_cedula()
    DatosComplementariosTrabajadorModel.objects.create(cedula=CEDULA, correo_alternativo='ana.alt@hotmail.com')

    r = cliente_con('identidad.cambiar_correo_acceso').post(
        f'{BASE}/cuentas/{CEDULA}/correo-acceso/', {'fuente': 'ALTERNATIVO'}, format='json'
    )

    assert r.status_code == 200, r.content
    assert r.json()['data'] == {'correo': 'ana.alt@hotmail.com', 'cuenta_creada': False, 'avisado': True}
    assert EventoOutboxModel.objects.filter(
        destinatario='ana.alt@hotmail.com', tipo='identidad.correo_acceso_cambiado'
    ).exists()
    assert login('ana.alt@hotmail.com', CEDULA).status_code == 200


def test_correo_acceso_ya_usado_por_otro_responde_409(base):
    cuenta_con_cedula()
    empleado('20888888', 'ocupado@gmail.com')

    r = cliente_con('identidad.cambiar_correo_acceso').post(
        f'{BASE}/cuentas/{CEDULA}/correo-acceso/', {'fuente': 'OTRO', 'correo': 'ocupado@gmail.com'}, format='json'
    )

    assert r.status_code == 409


def test_correo_acceso_exige_permiso(base):
    cuenta_con_cedula()

    r = cliente_con('identidad.ver_usuarios').post(
        f'{BASE}/cuentas/{CEDULA}/correo-acceso/', {'fuente': 'INSTITUCIONAL'}, format='json'
    )

    assert r.status_code == 403


# ─── Egreso ───

def _movimiento(cedula):
    """Entrega al receptor de identidad lo que emite `cargo_movimiento_ejecutado` (los demás receptores
    del evento, como el historial de movimientos, exigen un cargo real y no son objeto de esta prueba)."""
    ciclo_de_vida_por_movimiento(sender=None, cedula=cedula, cargo_id=1, tipo_movimiento='EGRESO')


def test_egreso_sin_pase_a_pasivo_desactiva_y_revoca_sesiones(base, condicion):
    cuenta = cuenta_con_cedula()  # sin asignaciones => SIN_ASIGNACION
    version_antes = RepoPermisosVersionORM().obtener(cuenta.pk)

    _movimiento(CEDULA)

    cuenta.refresh_from_db()
    assert cuenta.is_active is False
    assert RepoPermisosVersionORM().obtener(cuenta.pk) == version_antes + 1
    assert login(CORREO, CEDULA).status_code == 401


def test_pase_a_pasivo_no_desactiva_la_cuenta(base, condicion):
    cuenta = cuenta_con_cedula()
    condicion[CEDULA] = CondicionTrabajador.PASIVO

    _movimiento(CEDULA)

    cuenta.refresh_from_db()
    assert cuenta.is_active is True
