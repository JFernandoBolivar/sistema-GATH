"""U2: endpoints del restablecimiento en bloque (preview 200, Excel, ejecución síncrona o 202)."""
from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace

import pytest
from django.core.cache import cache
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

BASE = '/api/v1/identidad/usuarios/restablecer-acceso-bloque'
SUPERADMIN = '30799436'
CLASIFICACION = 'AMBOS'
ALCANCE = 'VENCIDA'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk=1):
        self.pk = pk
        self.id = None
        self.cedula_id = cedula
        self.rol_id = 1
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(cedula, permisos, pk=1):
    c = APIClient()
    c.force_authenticate(user=Usuario(cedula, permisos, pk))
    return c


def _cuerpo(**extra):
    cuerpo = {
        'clasificacion': CLASIFICACION, 'alcance': ALCANCE,
        'enviar_correo': True, 'motivo': 'Claves vencidas del personal',
    }
    cuerpo.update(extra)
    return cuerpo


def _preview(cliente, **extra):
    return cliente.post(f'{BASE}/preview/', _cuerpo(**extra), format='json')


def _empleado(cedula, apellidos=None):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='PRUEBA', apellidos=apellidos or cedula,
        sexoid=sexo, nacionalidad_id=1, correo=f'u{cedula}@conatel.gob.ve',
    )


def _cuenta(cedula, *, vence_en=None, apellidos=None):
    """Cuenta activa con la cédula como clave; con `vence_en` tiene fila de clave inicial."""
    cuenta = CuentaModel.objects.create_user(cedula=_empleado(cedula, apellidos), password=cedula)
    if vence_en is not None:
        PasswordInicialModel.objects.create(
            cuenta_id=cuenta.pk, emitida_en=vence_en - timedelta(days=7), vence_en=vence_en,
        )
    return cuenta


@pytest.fixture
def tareas(monkeypatch):
    """Solo el alcance TODOS usa Celery: se dobla `delay` y se registran las llamadas."""
    from apps.identidad.presentation.views import restablecer_acceso_bloque_views as vistas

    llamadas = []

    def ejecutar_delay(*args):
        llamadas.append(args)
        return SimpleNamespace(id='tarea-1')

    monkeypatch.setattr(vistas.restablecer_acceso_en_bloque_tarea, 'delay', ejecutar_delay)
    return llamadas


@pytest.fixture
def superadmin():
    return _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)


@pytest.fixture
def cuentas():
    ahora = timezone.now()
    vencida_1 = _cuenta('10000001', vence_en=ahora - timedelta(days=2), apellidos='ZAMORA')
    vencida_2 = _cuenta('10000002', vence_en=ahora - timedelta(days=1), apellidos='ALVAREZ')
    _cuenta('10000003', vence_en=ahora + timedelta(days=3))  # vigente
    _cuenta('10000004')  # sin fila de clave inicial
    return SimpleNamespace(vencidas={vencida_1.pk, vencida_2.pk})


def test_preview_es_sincrona_y_solo_superadministrador():
    assert _preview(_cliente('10000001', set())).status_code == 403

    # Tiene el permiso de Parámetros pero no es el superadministrador.
    admin_normal = _cliente('99000300', {'configuracion.editar'}, pk=2)
    assert _preview(admin_normal).status_code == 403

    respuesta = _preview(_cliente(SUPERADMIN, {'configuracion.editar'}, pk=3))
    assert respuesta.status_code == 200, respuesta.content
    assert set(respuesta.json()['data']) >= {
        'total', 'activos', 'pasivos', 'omitidas_administrativas', 'revisadas', 'muestra',
        'vence_en_nuevo',
    }


def test_preview_valida_el_motivo(superadmin):
    assert _preview(superadmin, motivo='corto').status_code == 400


def test_alcance_por_defecto_es_vencida(superadmin, cuentas):
    cuerpo = _cuerpo()
    cuerpo.pop('alcance')
    respuesta = superadmin.post(f'{BASE}/preview/', cuerpo, format='json')
    assert respuesta.json()['data']['total'] == 2


def test_vencida_solo_trae_cuentas_vencidas(superadmin, cuentas):
    data = _preview(superadmin).json()['data']
    assert data['total'] == 2
    assert {fila['cuenta_id'] for fila in data['muestra']} == cuentas.vencidas

    # Con fila (vigente o vencida), no la que no tiene fila.
    assert _preview(superadmin, alcance='SIN_PRIMER_INGRESO').json()['data']['total'] == 3
    assert _preview(superadmin, alcance='TODOS').json()['data']['total'] == 4


def test_la_muestra_trae_nombre_condicion_y_orden(superadmin, cuentas):
    from apps.identidad.infrastructure.tasks.restablecer_acceso_bloque_tasks import dias_vigencia

    data = _preview(superadmin).json()['data']
    muestra = data['muestra']
    assert [fila['nombre'] for fila in muestra] == sorted(fila['nombre'] for fila in muestra)
    assert muestra[0]['nombre'].startswith('ALVAREZ')
    assert all(fila['nombre'] and fila['condicion'] for fila in muestra)
    assert all(fila['vence_en'] for fila in muestra)
    esperado = (timezone.localtime() + timedelta(days=dias_vigencia())).date().isoformat()
    assert data['vence_en_nuevo'] == esperado


def test_ejecucion_vencida_es_sincrona_y_deja_la_vista_previa_en_cero(superadmin, cuentas):
    assert _preview(superadmin).json()['data']['total'] == 2
    respuesta = superadmin.post(
        f'{BASE}/', _cuerpo(confirmacion=2, enviar_correo=False), format='json',
    )
    assert respuesta.status_code == 200, respuesta.content
    data = respuesta.json()['data']
    assert data['estado'] == 'LISTO'
    resultado = data['resultado']
    assert resultado['restablecidas'] == 2 and resultado['errores'] == 0
    assert resultado['revisadas'] == 2 and resultado['omitidas_administrativas'] == 0
    assert resultado['vence_en_nuevo']

    # Ya no hay cuentas vencidas: «sigue saliendo todo igual» queda corregido.
    assert _preview(superadmin).json()['data']['total'] == 0


def test_ejecutar_exige_vista_previa_y_confirmacion(superadmin, cuentas, tareas):
    ejecucion = _cuerpo(confirmacion=2, enviar_correo=False)

    # Sin vista previa vigente.
    assert superadmin.post(f'{BASE}/', ejecucion, format='json').status_code == 409

    assert _preview(superadmin).status_code == 200
    # Confirmación distinta de la longitud de la lista.
    assert superadmin.post(f'{BASE}/', _cuerpo(confirmacion=4), format='json').status_code == 409
    assert superadmin.post(f'{BASE}/', ejecucion, format='json').status_code == 200
    # La vista previa se consume.
    assert superadmin.post(f'{BASE}/', ejecucion, format='json').status_code == 409
    assert tareas == []


def test_ejecucion_todos_sigue_siendo_asincrona(superadmin, cuentas, tareas):
    assert _preview(superadmin, alcance='TODOS').json()['data']['total'] == 4
    respuesta = superadmin.post(
        f'{BASE}/', _cuerpo(alcance='TODOS', confirmacion=4), format='json',
    )
    assert respuesta.status_code == 202, respuesta.content
    assert respuesta.json()['data']['task_id'] == 'tarea-1'
    assert tareas[0][1] == 'TODOS' and tareas[0][5] == 4 and len(tareas[0][6]) == 4


@pytest.mark.parametrize('con_lista_en_cache', [True, False])
def test_excel_trae_todas_las_cuentas_de_la_seleccion(superadmin, cuentas, con_lista_en_cache):
    if con_lista_en_cache:
        assert _preview(superadmin).json()['data']['total'] == 2
    else:
        cache.clear()
    respuesta = superadmin.get(
        f'{BASE}/preview/excel/', {'clasificacion': CLASIFICACION, 'alcance': 'VENCIDA'},
    )
    assert respuesta.status_code == 200
    assert respuesta['Content-Type'] == XLSX
    hoja = load_workbook(BytesIO(respuesta.content)).active
    cedulas = sorted(
        str(fila[0].value) for fila in hoja.iter_rows()
        if str(fila[0].value) in {'10000001', '10000002', '10000003', '10000004'}
    )
    assert cedulas == ['10000001', '10000002']


def test_excel_solo_superadministrador():
    respuesta = _cliente('99000300', {'configuracion.editar'}, pk=2).get(
        f'{BASE}/preview/excel/'
    )
    assert respuesta.status_code == 403


def test_estado_trae_el_resultado_de_la_tarea(monkeypatch):
    from apps.identidad.presentation.views import restablecer_acceso_bloque_views as vistas

    class FakeAsync:
        state = 'SUCCESS'
        result = {'estado': 'LISTO', 'restablecidas': 5, 'errores': 0, 'total': 5}

    monkeypatch.setattr(vistas, 'AsyncResult', lambda task_id: FakeAsync())
    superadmin = _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)
    data = superadmin.get(f'{BASE}/tarea-1/').json()['data']
    assert data['estado'] == 'LISTO' and data['resultado']['restablecidas'] == 5
