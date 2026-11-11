"""Corregir cédula de un trabajador: API (permiso, 400/404/409/200) y reescritura real en la BD."""
import datetime

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.intento_fallido_model import IntentoFallidoModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
from apps.identidad.infrastructure.models.usuario_permiso_model import UsuarioPermisoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db
BASE = '/api/v1/identidad/usuarios/corregir-cedula/'
VIEJA, NUEVA = '12345678', '12345687'
PERMISO = 'personal.corregir_cedula'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, cedula='30799436', pk=1):
        self.pk, self.id, self.cedula_id, self.rol_id, self.rol = pk, None, cedula, 1, None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(permisos=(PERMISO,)):
    c = APIClient()
    c.force_authenticate(user=Usuario(permisos))
    return c


def _cuerpo(**extra):
    cuerpo = {'cedula_actual': VIEJA, 'cedula_nueva': NUEVA,
              'motivo': 'Error de transcripción', 'confirmacion': NUEVA}
    cuerpo.update(extra)
    return cuerpo


def _empleado(cedula, nombres='ANA'):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres=nombres, apellidos='PEREZ', sexoid=sexo, nacionalidad_id=1,
    )


@pytest.fixture
def escenario():
    empleado = _empleado(VIEJA)
    cuenta = CuentaModel.objects.create_user(cedula=empleado, password=VIEJA)
    ahora = datetime.datetime.now(datetime.timezone.utc)
    PasswordInicialModel.objects.create(
        cuenta_id=cuenta.pk, emitida_en=ahora, vence_en=ahora + datetime.timedelta(days=7),
    )
    parentesco = ParentescoModel.objects.create(descripcion_parentesco='HIJO TEST')
    EmployeefamilyModel.objects.create(
        employeecedula=empleado, cedulaFamiliar=f'{VIEJA}-1', primer_nombre='NINO',
        primer_apellido='PEREZ', parentesco=parentesco, fechanacimiento=datetime.date(2020, 1, 1),
        sexo=empleado.sexoid,
    )
    proceso = ProcesoFeDeVidaModel.objects.create(
        nombre='P', fecha_apertura=ahora, fecha_cierre=ahora + datetime.timedelta(days=5),
    )
    SolicitudFeDeVidaModel.objects.create(proceso=proceso, cedula=VIEJA)
    UsuarioPermisoModel.objects.create(cedula=VIEJA)
    IntentoFallidoModel.objects.create(cedula=VIEJA)
    return {'empleado': empleado, 'cuenta': cuenta}


def _ceds(tabla, columna):
    with connection.cursor() as c:
        c.execute(f'SELECT "{columna}" FROM "{tabla}"')
        return {r[0] for r in c.fetchall()}


def test_correccion_completa_reescribe_todo_y_la_clave_inicial_sigue_a_la_cedula(escenario):
    auditorias = AuditoriaLog.objects.count()
    antes_actor = list(AuditoriaLog.objects.values_list('actor_cedula', flat=True))
    r = _cliente().post(BASE, _cuerpo(), format='json')
    assert r.status_code == 200, r.data
    datos = r.data['data']
    assert datos['cedula_anterior'] == VIEJA and datos['clave_inicial_actualizada'] is True
    tablas = {a['tabla'] for a in datos['afectados']}
    assert {'Ficha del trabajador', 'Cuenta de acceso', 'Familiares',
            'Solicitudes de fe de vida', 'Cédulas sintéticas de familiares'} <= tablas
    assert datos['total_registros'] == sum(a['registros'] for a in datos['afectados'])

    with connection.cursor() as c:
        c.execute('SET CONSTRAINTS ALL IMMEDIATE')  # las FK diferidas deben cumplirse
    assert _ceds('Employee', 'cedulaIdentidad') == {NUEVA}
    assert _ceds('USER_cuenta', 'cedula') == {NUEVA}
    assert _ceds('RAC_employeefamily', 'employeeCedula') == {NUEVA}
    assert _ceds('RAC_employeefamily', 'cedulaFamiliar') == {f'{NUEVA}-1'}
    assert _ceds('fe_de_vida_solicitud', 'cedula') == {NUEVA}
    assert _ceds('identidad_usuario_permiso', 'cedula') == {NUEVA}
    assert _ceds('identidad_intento_fallido', 'cedula') == {NUEVA}

    cuenta = CuentaModel.objects.get(pk=escenario['cuenta'].pk)
    assert cuenta.check_password(NUEVA) and not cuenta.check_password(VIEJA)
    assert PasswordInicialModel.objects.filter(cuenta_id=cuenta.pk).exists()

    # auditoria_log: solo se agrega la fila nueva; las existentes no cambian.
    assert AuditoriaLog.objects.count() == auditorias + 1
    assert list(AuditoriaLog.objects.order_by('fecha_hora', 'id').values_list('actor_cedula', flat=True))[:len(antes_actor)] == antes_actor
    nueva = AuditoriaLog.objects.get(accion='identidad.cedula_corregida')
    assert nueva.estado_previo == {'cedula': VIEJA} and nueva.estado_nuevo['cedula'] == NUEVA


def test_sin_clave_inicial_conserva_su_clave(escenario):
    PasswordInicialModel.objects.all().delete()
    r = _cliente().post(BASE, _cuerpo(), format='json')
    assert r.status_code == 200 and r.data['data']['clave_inicial_actualizada'] is False
    cuenta = CuentaModel.objects.get(pk=escenario['cuenta'].pk)
    assert cuenta.check_password(VIEJA) and not cuenta.check_password(NUEVA)
    assert not PasswordInicialModel.objects.filter(cuenta_id=cuenta.pk).exists()


def test_vista_previa(escenario):
    r = _cliente().post(BASE + 'preview/', {'cedula_actual': VIEJA, 'cedula_nueva': NUEVA}, format='json')
    assert r.status_code == 200, r.data
    d = r.data['data']
    assert d['trabajador']['nombre'] == 'PEREZ ANA' and d['trabajador']['condicion'] == 'SIN_ASIGNACION'
    assert d['cuenta']['existe'] and d['cuenta']['clave_inicial_pendiente']
    assert d['total_registros'] == sum(a['registros'] for a in d['afectados']) >= 5
    assert _ceds('Employee', 'cedulaIdentidad') == {VIEJA}  # no escribe nada


def test_choque_con_cedula_existente_es_409(escenario):
    _empleado('87654321', 'LUIS')
    r = _cliente().post(BASE, _cuerpo(cedula_nueva='87654321', confirmacion='87654321'), format='json')
    assert r.status_code == 409
    r = _cliente().post(BASE + 'preview/', {'cedula_actual': VIEJA, 'cedula_nueva': '87654321'}, format='json')
    assert r.status_code == 409


def test_trabajador_inexistente_es_404(escenario):
    r = _cliente().post(BASE, _cuerpo(cedula_actual='11111111'), format='json')
    assert r.status_code == 404


@pytest.mark.parametrize('cambio', [
    {'cedula_nueva': '12ab', 'confirmacion': '12ab'},
    {'cedula_nueva': VIEJA, 'confirmacion': VIEJA},
    {'confirmacion': '99999999'},
    {'motivo': 'corto'},
])
def test_entradas_invalidas_son_400(escenario, cambio):
    assert _cliente().post(BASE, _cuerpo(**cambio), format='json').status_code == 400
    assert _ceds('Employee', 'cedulaIdentidad') == {VIEJA}


def test_sin_el_permiso_es_403(escenario):
    assert _cliente(()).post(BASE, _cuerpo(), format='json').status_code == 403
    assert _cliente(()).post(BASE + 'preview/', _cuerpo(), format='json').status_code == 403
    assert _cliente(('personal.ver',)).post(BASE, _cuerpo(), format='json').status_code == 403
    assert _ceds('Employee', 'cedulaIdentidad') == {VIEJA}


def test_un_fallo_a_mitad_hace_rollback_completo(escenario, monkeypatch):
    from apps.identidad.infrastructure.repositories import repo_cuentas_orm

    def falla(self, id, password):
        raise RuntimeError('fallo a mitad')

    monkeypatch.setattr(repo_cuentas_orm.RepoCuentasORM, 'establecer_password', falla)
    cliente = _cliente()
    cliente.raise_request_exception = False
    r = cliente.post(BASE, _cuerpo(), format='json')
    assert r.status_code >= 500
    assert _ceds('Employee', 'cedulaIdentidad') == {VIEJA}
    assert _ceds('fe_de_vida_solicitud', 'cedula') == {VIEJA}
    assert _ceds('RAC_employeefamily', 'cedulaFamiliar') == {f'{VIEJA}-1'}
    assert not AuditoriaLog.objects.filter(accion='identidad.cedula_corregida').exists()
