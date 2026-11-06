"""FIX-QA9: la lista de puntos de cuenta responde con datos reales.

Cubre el `FieldError` de `select_related('denominacion_cargo')` y los nombres
resueltos del mapeo (trabajador, cargo, oficinas, divisiones y motivo), además
de los filtros que envía el frontend.
"""
import datetime

import pytest
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
    TipoMovimientoModel,
    TipoNominaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.puntocuenta.infrastructure.models.punto_cuenta_model import PuntoCuentaModel

pytestmark = pytest.mark.django_db
BASE = '/api/v1/puntocuenta/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=('puntocuenta.ver',)):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(permisos=None):
    c = APIClient()
    c.force_authenticate(user=Usuario() if permisos is None else Usuario(permisos))
    return c


@pytest.fixture
def datos():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    oficina = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='GESTION HUMANA', dependenciaId=dependencia,
    )
    division = DireccionLineaModel.objects.create(
        Codigo='L1', direccion_linea='NOMINA', direccionGeneral=oficina,
    )
    motivo = TipoMovimientoModel.objects.create(movimiento='TRASLADO')
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='12345678', nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo, total_anos_apn=0,
    )
    asignacion = AsigTrabajoModel.objects.create(
        employee=empleado, codigo='C-1', denominacioncargoid=cargo,
        denominacioncargoespecificoid=especifico, tiponominaid=nomina, estatusid=estatus,
        Dependencia=dependencia, DireccionGeneral=oficina, DireccionLinea=division,
    )
    return {
        'asignacion': asignacion, 'empleado': empleado, 'dependencia': dependencia,
        'oficina': oficina, 'division': division, 'motivo': motivo,
    }


def _punto(datos, **extra):
    return PuntoCuentaModel.objects.create(
        cargo_id=datos['asignacion'].pk,
        empleado_cedula=datos['empleado'].cedulaidentidad,
        dependencia_origen_id=datos['dependencia'].pk,
        dependencia_destino_id=datos['dependencia'].pk,
        oficina_origen_id=datos['oficina'].pk,
        oficina_destino_id=datos['oficina'].pk,
        division_origen_id=datos['division'].pk,
        division_destino_id=datos['division'].pk,
        motivo_id=datos['motivo'].pk,
        usuario_id=1,
        **extra,
    )


def test_lista_resuelve_nombres_y_no_da_500(datos):
    _punto(datos)
    r = cliente().get(BASE)
    assert r.status_code == 200, r.content
    fila = r.json()['data'][0]
    assert fila['empleado_nombre'] == 'ANA PEREZ'
    assert fila['cargo_codigo'] == 'C-1'
    assert fila['cargo_nombre'] == 'ANALISTA'
    assert fila['oficina_origen'] == 'GESTION HUMANA'
    assert fila['division_origen'] == 'NOMINA'
    assert fila['motivo_nombre'] == 'TRASLADO'


def test_lista_filtra_por_cedula_y_oficina(datos):
    _punto(datos)
    assert cliente().get(f'{BASE}?cedula=1234').json()['data']
    assert not cliente().get(f'{BASE}?cedula=9999').json()['data']
    oficina_id = datos['oficina'].pk
    assert cliente().get(f'{BASE}?oficina_id={oficina_id}').json()['data']
    assert not cliente().get(f'{BASE}?oficina_id=999999').json()['data']


def test_lista_exige_permiso(datos):
    assert cliente(set()).get(BASE).status_code == 403
