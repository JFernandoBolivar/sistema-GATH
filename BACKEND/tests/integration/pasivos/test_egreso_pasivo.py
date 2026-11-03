"""Egreso de un pasivo: solo fallecimiento y alta de sobrevivientes C20."""
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
    ParentescoModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
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
def escenario():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'},
    )
    sexo = SexoModel.objects.create(sexo='M')
    EstatusModel.objects.create(estatus='PASIVO')
    EstatusModel.objects.create(estatus='EGRESADO')
    EstatusModel.objects.create(estatus='ACTIVO')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    TipoNominaModel.objects.create(nomina='PENSIONADO SOBREVIVIENTE', es_activo=False)
    fallecimiento = TipoMovimientoModel.objects.create(movimiento='FALLECIMIENTO')
    renuncia = TipoMovimientoModel.objects.create(movimiento='RENUNCIA')
    cargo = DenominacionCargoModel.objects.create(cargo='PERSONAL PASIVO')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='PERSONAL PASIVO')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )
    rol = RolModel.objects.create(nombre_rol='RRHH')
    operador = EmployeeModel.objects.create(
        cedulaidentidad='V-9999', nombres='Operador', apellidos='RRHH', sexoid=sexo,
    )
    CuentaModel.objects.create(cedula=operador, rol=rol, password='!')

    pasivo = EmployeeModel.objects.create(
        cedulaidentidad='V-5000', nombres='Pasivo', apellidos='Prueba', sexoid=sexo,
    )
    AsigTrabajoModel.objects.create(
        employee=pasivo, codigo='J_5000', denominacioncargoid=cargo,
        denominacioncargoespecificoid=cargo_esp, tiponominaid=nomina,
        estatusid=EstatusModel.objects.get(estatus='PASIVO'), Tipo_personal=tipo_personal,
        Dependencia=dep,
    )
    parentesco = ParentescoModel.objects.create(descripcion_parentesco='CONYUGE')
    familiar = EmployeefamilyModel.objects.create(
        employeecedula=pasivo, cedulaFamiliar='V-5001', primer_nombre='Ana',
        primer_apellido='Prueba', parentesco=parentesco,
        fechanacimiento=datetime.date(1970, 1, 1), sexo=sexo, heredero=True,
    )
    return {
        'pasivo': pasivo,
        'familiar': familiar,
        'fallecimiento': fallecimiento,
        'renuncia': renuncia,
        'nomina': nomina,
        'tipo_personal': tipo_personal,
        'cargo': cargo,
        'cargo_esp': cargo_esp,
    }


def test_motivos_de_egreso_pasivo_solo_fallecimiento(escenario):
    respuesta = _cliente('pasivos.cambiar_condicion').get('/api/v1/pasivos/motivos-egreso/')
    assert respuesta.status_code == 200
    nombres = [m['nombre'] for m in respuesta.json()['data']]
    assert nombres == ['FALLECIMIENTO']


def test_egreso_pasivo_por_fallecimiento_y_sobreviviente(escenario):
    respuesta = _cliente('pasivos.cambiar_condicion').post(
        '/api/v1/pasivos/V-5000/egreso/',
        {'motivo_id': escenario['fallecimiento'].pk, 'sobrevivientes_familiar_ids': [escenario['familiar'].pk]},
        format='json',
    )
    assert respuesta.status_code == 200, respuesta.content

    asignacion = AsigTrabajoModel.objects.get(employee=escenario['pasivo'])
    assert asignacion.estatusid.estatus == 'EGRESADO'
    egreso = EmployeeEgresadoModel.objects.get(employee=escenario['pasivo'])
    assert egreso.motivo_egreso.movimiento == 'FALLECIMIENTO'

    familiar = EmployeeModel.objects.get(cedulaidentidad='V-5001')
    asignacion_familiar = AsigTrabajoModel.objects.get(employee=familiar)
    assert asignacion_familiar.Tipo_personal.tipo_personal == 'PASIVO'
    assert asignacion_familiar.tiponominaid.nomina == 'PENSIONADO SOBREVIVIENTE'


def test_rechaza_motivo_de_activo(escenario):
    respuesta = _cliente('pasivos.cambiar_condicion').post(
        '/api/v1/pasivos/V-5000/egreso/',
        {'motivo_id': escenario['renuncia'].pk},
        format='json',
    )
    assert respuesta.status_code == 400
    asignacion = AsigTrabajoModel.objects.get(employee=escenario['pasivo'])
    assert asignacion.estatusid.estatus == 'PASIVO'


def test_el_pasivo_egresado_sale_del_listado_vigente(escenario):
    """Tras el fallecimiento deja de aparecer en /pasivos/consultar."""
    from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM

    repo = RepoPasivosORM()
    _, total_antes = repo.listar_pasivos_paginados(cedula='V-5000')
    assert total_antes == 1

    repo.egresar_pasivo('V-5000', escenario['fallecimiento'].pk)

    filas, total = repo.listar_pasivos_paginados(cedula='V-5000')
    assert filas == []
    assert total == 0
    assert all(p.cedula != 'V-5000' for p in repo.listar_pasivos())

