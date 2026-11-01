"""Alta directa de pasivo: catálogos reales, permisos y movimiento de ingreso."""
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
    TipoPersonalModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=(), pk=1):
        self.pk = self.id = pk
        self.cedula_id = 'V-1'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    cuenta = CuentaModel.objects.order_by('pk').first()
    api.force_authenticate(user=Usuario(permisos, pk=cuenta.pk if cuenta else 1))
    return api


@pytest.fixture
def catalogos():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'},
    )
    sexo = SexoModel.objects.create(sexo='M')
    EstatusModel.objects.create(estatus='PASIVO')
    EstatusModel.objects.create(estatus='ACTIVO')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina_pasivo = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    nomina_activo = TipoNominaModel.objects.create(nomina='CONTRATADO', es_activo=True)
    cargo = DenominacionCargoModel.objects.create(cargo='PERSONAL PASIVO')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='PERSONAL PASIVO')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )
    TipoMovimientoModel.objects.create(movimiento='JUBILACION DE DERECHO')
    rol = RolModel.objects.create(nombre_rol='RRHH')
    operador = EmployeeModel.objects.create(
        cedulaidentidad='V-9999', nombres='Operador', apellidos='RRHH', sexoid=sexo,
    )
    CuentaModel.objects.create(cedula=operador, rol=rol, password='!')
    return {
        'sexo': sexo,
        'nomina_pasivo': nomina_pasivo,
        'nomina_activo': nomina_activo,
        'cargo': cargo,
        'cargo_esp': cargo_esp,
        'tipo_personal': tipo_personal,
    }


def _cuerpo(catalogos, cedula='V-7777', tipo_nomina=None):
    return {
        'cedula': cedula,
        'nombres': 'Ana',
        'apellidos': 'Pérez',
        'sexo_id': catalogos['sexo'].pk,
        'fecha_nacimiento': '1960-01-15',
        'tipo_nomina_id': (tipo_nomina or catalogos['nomina_pasivo']).pk,
    }


def test_registrar_pasivo_directo_crea_employee_y_asignacion(catalogos):
    respuesta = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/', _cuerpo(catalogos), format='json',
    )
    assert respuesta.status_code == 201, respuesta.content
    datos = respuesta.json()['data']
    assert datos['cedula'] == 'V-7777'
    assert datos['tipo_nomina_id'] == catalogos['nomina_pasivo'].pk

    empleado = EmployeeModel.objects.get(cedulaidentidad='V-7777')
    asignacion = AsigTrabajoModel.objects.get(employee=empleado)
    assert asignacion.Tipo_personal.tipo_personal == 'PASIVO'
    assert asignacion.tiponominaid.es_activo is False
    assert asignacion.denominacioncargoid.cargo == 'PERSONAL PASIVO'
    assert asignacion.denominacioncargoespecificoid.cargo == 'PERSONAL PASIVO'
    assert asignacion.Dependencia.dependencia == 'NIVEL DE APOYO'
    assert asignacion.DireccionGeneral.direccion_general == 'OFICINA DE GESTION HUMANA'
    assert asignacion.estatusid.estatus == 'PASIVO'


def test_rechaza_nomina_de_activos(catalogos):
    respuesta = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/',
        _cuerpo(catalogos, cedula='V-7778', tipo_nomina=catalogos['nomina_activo']),
        format='json',
    )
    assert respuesta.status_code == 400
    assert not EmployeeModel.objects.filter(cedulaidentidad='V-7778').exists()


def test_rechaza_cedula_duplicada(catalogos):
    cuerpo = _cuerpo(catalogos, cedula='V-7779')
    api = _cliente('pasivos.crear')
    assert api.post('/api/v1/pasivos/', cuerpo, format='json').status_code == 201
    assert api.post('/api/v1/pasivos/', cuerpo, format='json').status_code == 409


def test_sin_permiso_de_crear_responde_403(catalogos):
    respuesta = _cliente('pasivos.ver').post(
        '/api/v1/pasivos/', _cuerpo(catalogos), format='json',
    )
    assert respuesta.status_code == 403
