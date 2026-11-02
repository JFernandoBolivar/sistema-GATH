"""API de la bitácora de auditoría (D10) contra la BD de pruebas."""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.auditoria.domain.value_objects.permisos import (
    PERMISO_EXPORTAR,
    PERMISO_VER_LOGS,
    PERMISO_VER_SEGURIDAD,
)
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.intento_fallido_model import IntentoFallidoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/auditoria/'
CEDULA = 'V12345678'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=1, cedula=CEDULA):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def data(respuesta):
    return respuesta.json()['data']


def crear(accion='personal.editar', modulo='personal', cedula=CEDULA, resultado='SUCCESS', **extra):
    return AuditoriaLog.objects.create(
        trace_id='t',
        actor_id=1,
        actor_cedula=cedula,
        actor_rol='ANALISTA',
        modulo=modulo,
        accion=accion,
        recurso_tipo='Employee',
        recurso_id='1',
        ip_origen='10.0.0.1',
        user_agent='Mozilla/5.0',
        resultado=resultado,
        **extra,
    )


@pytest.fixture
def empleados():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='Ana', apellidos='Pérez',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo,
    )


def test_paginacion_en_el_servidor_y_tope_50():
    for _ in range(12):
        crear()

    primera = data(cliente(PERMISO_VER_LOGS).get(BASE))
    segunda = data(cliente(PERMISO_VER_LOGS).get(f'{BASE}?pagina=2&page_size=10'))
    tope = data(cliente(PERMISO_VER_LOGS).get(f'{BASE}?page_size=500'))

    assert primera['total'] == 12 and len(primera['resultados']) == 10
    assert segunda['pagina'] == 2 and len(segunda['resultados']) == 2
    assert tope['tamano'] == 50


def test_orden_determinista_mas_reciente_primero():
    antiguo = crear()
    reciente = crear()
    AuditoriaLog.objects.filter(pk=antiguo.pk).update(
        fecha_hora=datetime.datetime(2026, 1, 1, 10, tzinfo=datetime.timezone.utc)
    )
    AuditoriaLog.objects.filter(pk=reciente.pk).update(
        fecha_hora=datetime.datetime(2026, 1, 2, 10, tzinfo=datetime.timezone.utc)
    )

    resultados = data(cliente(PERMISO_VER_LOGS).get(BASE))['resultados']
    assert [r['id'] for r in resultados] == [str(reciente.pk), str(antiguo.pk)]


def test_filtros_por_usuario_accion_modulo_recurso_ip_fecha_y_resultado(empleados):
    crear(accion='personal.editar')
    crear(accion='movimientos.registrar', modulo='movimientos', resultado='DENIED')
    crear(accion='personal.editar', resultado='FAILED')

    api = cliente(PERMISO_VER_LOGS)
    assert data(api.get(f'{BASE}?accion=personal.editar'))['total'] == 2
    assert data(api.get(f'{BASE}?modulo=movimientos'))['total'] == 1
    assert data(api.get(f'{BASE}?resultado=DENIED'))['total'] == 1
    assert data(api.get(f'{BASE}?recurso=Employee'))['total'] == 3
    assert data(api.get(f'{BASE}?ip=10.0.0.1'))['total'] == 3
    assert data(api.get(f'{BASE}?usuario=Ana'))['total'] == 3
    assert data(api.get(f'{BASE}?usuario={CEDULA}'))['total'] == 3
    assert data(api.get(f'{BASE}?desde=2000-01-01&hasta=2999-12-31'))['total'] == 3
    assert data(api.get(f'{BASE}?desde=2999-01-01'))['total'] == 0


def test_rango_invalido_da_400():
    respuesta = cliente(PERMISO_VER_LOGS).get(f'{BASE}?desde=2026-02-01&hasta=2026-01-01')
    assert respuesta.status_code == 400


def test_el_detalle_sanea_tokens_y_muestra_diferencias():
    fila = crear(
        estado_previo={'nombre': 'Ana', 'password': 'uno', 'token': 'abc'},
        estado_nuevo={'nombre': 'Ana María', 'password': 'dos', 'token': 'xyz'},
    )

    respuesta = cliente(PERMISO_VER_LOGS).get(f'{BASE}{fila.pk}/')
    detalle = data(respuesta)

    assert detalle['estado_previo']['password'] == '***'
    assert detalle['estado_nuevo']['token'] == '***'
    assert {d['campo'] for d in detalle['diferencias']} == {'nombre', 'password', 'token'}


def test_exportaciones_pdf_y_excel_con_sus_cabeceras():
    crear()
    api = cliente(PERMISO_VER_LOGS, PERMISO_EXPORTAR)

    pdf = api.get(f'{BASE}pdf/?modulo=personal')
    assert pdf.status_code == 200
    assert pdf['Content-Type'] == 'application/pdf'
    assert pdf['X-Reporte-Truncado'] in ('true', 'false')

    excel = api.get(f'{BASE}excel/?modulo=personal')
    assert excel.status_code == 200
    assert 'spreadsheetml' in excel['Content-Type']
    assert excel['X-Reporte-Limite']


def test_permisos_de_consulta_exportacion_e_incidentes():
    api = cliente()
    assert api.get(BASE).status_code == 403
    assert api.get(f'{BASE}pdf/').status_code == 403
    assert api.get(f'{BASE}incidentes/').status_code == 403

    assert cliente(PERMISO_VER_LOGS).get(BASE).status_code == 200
    assert cliente(PERMISO_VER_LOGS).get(f'{BASE}pdf/').status_code == 403
    assert cliente(PERMISO_EXPORTAR).get(f'{BASE}pdf/').status_code == 200
    assert cliente(PERMISO_VER_SEGURIDAD).get(f'{BASE}incidentes/').status_code == 200


def test_incidentes_de_seguridad_lista_los_bloqueos(empleados):
    IntentoFallidoModel.objects.create(cedula=CEDULA, ip='10.0.0.9', resultado='bloqueo_aplicado')

    respuesta = cliente(PERMISO_VER_SEGURIDAD).get(f'{BASE}incidentes/')

    assert respuesta.status_code == 200
    cuerpo = data(respuesta)
    assert cuerpo['total'] == 1
    assert cuerpo['resultados'][0]['nombre'] == 'Ana Pérez'
    assert cuerpo['resultados'][0]['resultado'] == 'bloqueo_aplicado'


def test_opciones_salen_de_los_valores_reales():
    crear(accion='personal.editar', modulo='personal', resultado='SUCCESS')
    crear(accion='movimientos.registrar', modulo='movimientos', resultado='DENIED')

    opciones = data(cliente(PERMISO_VER_LOGS).get(f'{BASE}opciones/'))

    assert opciones['acciones'] == ['movimientos.registrar', 'personal.editar']
    assert opciones['modulos'] == ['movimientos', 'personal']
    assert set(opciones['resultados']) == {'SUCCESS', 'DENIED'}
