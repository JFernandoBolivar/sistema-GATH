"""
C20: alta de pensionados por sobrevivencia sobre BD de pruebas (repo ORM real).
"""
import datetime

import pytest

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
from apps.pasivos.application.dtos.pasivos_dtos import CrearSobrevivientesDTO
from apps.pasivos.application.use_cases.crear_sobrevivientes import ejecutar_creacion_sobrevivientes
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.personal.infrastructure.models.expediente_models import PerfilFisicoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    EstatusModel.objects.create(estatus='ACTIVO')
    pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina = TipoNominaModel.objects.create(nomina='PENSIONADO SOBREVIVIENTE')
    jubilado = TipoNominaModel.objects.create(nomina='JUBILADO')
    motivo_pension = TipoMovimientoModel.objects.create(movimiento='PENSION POR SOBREVIVIENTE')
    fallec = TipoMovimientoModel.objects.create(movimiento='FALLECIMIENTO')
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dep = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep)
    titular = EmployeeModel.objects.create(
        cedulaidentidad='V1000', nombres='Tito', apellidos='Lar', sexoid=sexo)
    AsigTrabajoModel.objects.create(
        employee=titular, codigo='X-1', denominacioncargoid=dc, denominacioncargoespecificoid=dce,
        tiponominaid=nomina, estatusid=EstatusModel.objects.get(estatus='ACTIVO'), Tipo_personal=pasivo)
    EmployeeEgresadoModel.objects.create(
        employee=titular, fechaingresoorganismo=datetime.date(2000, 1, 1), motivo_egreso=fallec)
    parentesco = ParentescoModel.objects.create(descripcion_parentesco='CONYUGE')
    fam = EmployeefamilyModel.objects.create(
        employeecedula=titular, cedulaFamiliar='V2000', primer_nombre='Ana', primer_apellido='Lar',
        parentesco=parentesco, fechanacimiento=datetime.date(1970, 5, 5), sexo=sexo, heredero=True)
    PerfilFisicoModel.objects.create(familiar=fam)
    rol = RolModel.objects.create(nombre_rol='RRHH')
    operador = EmployeeModel.objects.create(
        cedulaidentidad='V9999', nombres='Op', apellidos='Erador', sexoid=sexo)
    cuenta = CuentaModel.objects.create(cedula=operador, rol=rol, password='!')
    return {'usuario_id': cuenta.pk, 'nomina': nomina, 'fam': fam, 'jubilado': jubilado, 'motivo': motivo_pension}


def test_crea_employee_asignacion_pasivo_y_copia_perfil_e_idempotente(escenario):
    dto = CrearSobrevivientesDTO(cedula_titular='V1000')  # nómina por defecto = sobrevivencia
    res = ejecutar_creacion_sobrevivientes(RepoPasivosORM(), dto)

    assert [(r.cedula, r.creado) for r in res] == [('V2000', True)]
    emp = EmployeeModel.objects.get(cedulaidentidad='V2000')
    assert emp.nombres == 'Ana'
    asig = AsigTrabajoModel.objects.get(employee=emp)
    assert asig.Tipo_personal.tipo_personal == 'PASIVO'
    assert asig.tiponominaid_id == escenario['nomina'].pk
    assert 'V1000' in asig.observaciones and 'Parentesco' in asig.observaciones
    assert PerfilFisicoModel.objects.filter(empleado=emp).count() == 1

    res2 = ejecutar_creacion_sobrevivientes(RepoPasivosORM(), dto)
    assert res2[0].creado is False
    assert EmployeeModel.objects.filter(cedulaidentidad='V2000').count() == 1
    assert AsigTrabajoModel.objects.filter(employee=emp).count() == 1


def test_titular_no_fallecido_se_rechaza(escenario):
    EmployeeEgresadoModel.objects.all().update(motivo_egreso=TipoMovimientoModel.objects.create(
        movimiento='JUBILACION'))
    with pytest.raises(ValidationError):
        ejecutar_creacion_sobrevivientes(
            RepoPasivosORM(),
            CrearSobrevivientesDTO(cedula_titular='V1000', tipo_nomina_id=escenario['nomina'].pk))
    assert not EmployeeModel.objects.filter(cedulaidentidad='V2000').exists()


def test_nomina_distinta_de_sobrevivencia_se_rechaza(escenario):
    with pytest.raises(ValidationError):
        ejecutar_creacion_sobrevivientes(
            RepoPasivosORM(),
            CrearSobrevivientesDTO(cedula_titular='V1000', tipo_nomina_id=escenario['jubilado'].pk))
    assert not EmployeeModel.objects.filter(cedulaidentidad='V2000').exists()


def test_alta_emite_movimiento_de_ingreso_con_el_usuario(escenario):
    from apps.cargos.domain import events

    recibidos = []

    def receptor(sender, **kw):
        recibidos.append(kw)

    events.cargo_movimiento_ejecutado.connect(receptor)
    try:
        ejecutar_creacion_sobrevivientes(
            RepoPasivosORM(), CrearSobrevivientesDTO(cedula_titular='V1000', usuario_id=escenario['usuario_id']))
    finally:
        events.cargo_movimiento_ejecutado.disconnect(receptor)
    assert len(recibidos) == 1
    assert recibidos[0]['cedula'] == 'V2000' and recibidos[0]['tipo_movimiento'] == 'INGRESO'
    assert recibidos[0]['motivo_id'] == escenario['motivo'].pk and recibidos[0]['usuario_id'] == escenario['usuario_id']


class _Usuario:
    is_authenticated = True
    is_active = True
    id = pk = 0
    cedula_id = 'V9999'
    rol = None

    def tiene_permiso(self, codigo):
        return codigo == 'pasivos.crear'


def test_endpoint_audita_con_el_usuario_y_exige_permiso(escenario):
    from rest_framework.test import APIClient

    from core.infrastructure.models.auditoria import AuditoriaLog

    c = APIClient()
    c.force_authenticate(user=type('SinPermiso', (_Usuario,), {'tiene_permiso': lambda s, x: False})())
    assert c.post('/api/v1/pasivos/V1000/sobrevivientes/', {}, format='json').status_code == 403

    usuario = _Usuario()
    usuario.id = usuario.pk = escenario['usuario_id']
    c.force_authenticate(user=usuario)
    r = c.post('/api/v1/pasivos/V1000/sobrevivientes/', {}, format='json')
    assert r.status_code == 201, r.content
    assert r.json()['data'][0]['creado'] is True
    log = AuditoriaLog.objects.get(accion='pasivos.alta_sobreviviente')
    assert log.actor_id == escenario['usuario_id'] and log.recurso_id == 'V2000'
    # Reintento idempotente: no genera una segunda entrada de auditoría.
    c.post('/api/v1/pasivos/V1000/sobrevivientes/', {}, format='json')
    assert AuditoriaLog.objects.filter(accion='pasivos.alta_sobreviviente').count() == 1
