"""Condición del trabajador y ciclo de vida de la cuenta al egresar un pasivo (BD de pruebas)."""
import datetime
import uuid

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.desactivacion_egreso_model import DesactivacionEgresoModel
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CEDULA = '8800001'
CEDULA_LEGADO = '8800002'


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANA'})
    sexo = SexoModel.objects.create(sexo='F')
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    pasivo = EstatusModel.objects.create(estatus='PASIVO')
    egresado = EstatusModel.objects.create(estatus='EGRESADO')
    tipo_pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    tipo_activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    dc = DenominacionCargoModel.objects.create(cargo='PERSONAL PASIVO')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='PERSONAL PASIVO')
    cat = CategoriaMovimientoModel.objects.create(categoria='EGRESO PASIVO')
    motivo = TipoMovimientoModel.objects.create(movimiento='FALLECIMIENTO', categoria=cat)
    rol = RolModel.objects.create(nombre_rol='AUTOGESTION')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    dg = DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )

    def empleado(cedula):
        return EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres='ANA', apellidos='PRUEBA', sexoid=sexo,
        )

    def asignacion(emp, tipo, estatus):
        return AsigTrabajoModel.objects.create(
            employee=emp, codigo=f'C-{uuid.uuid4().hex[:12]}',
            denominacioncargoid=dc, denominacioncargoespecificoid=dce, tiponominaid=nomina,
            estatusid=estatus, Tipo_personal=tipo, Dependencia=dep, DireccionGeneral=dg,
        )

    operador = EmployeeModel.objects.create(
        cedulaidentidad='V-9999', nombres='Operador', apellidos='RRHH', sexoid=sexo,
    )
    cuenta_operador = CuentaModel.objects.create(cedula=operador, rol=rol, password='!')

    return {
        'sexo': sexo, 'activo': activo, 'pasivo': pasivo, 'egresado': egresado,
        'tipo_pasivo': tipo_pasivo, 'tipo_activo': tipo_activo, 'nomina': nomina,
        'motivo': motivo, 'rol': rol, 'empleado': empleado, 'asignacion': asignacion,
        'operador_id': cuenta_operador.pk,
    }


def test_pasivo_vigente_y_sus_cedulas(escenario):
    emp = escenario['empleado'](CEDULA)
    escenario['asignacion'](emp, escenario['tipo_pasivo'], escenario['activo'])
    repo = RepoCondicionTrabajadorORM()

    assert repo.condicion_por_cedula(CEDULA) is CondicionTrabajador.PASIVO
    assert CEDULA in repo.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)
    assert CEDULA not in repo.cedulas_por_condicion(CondicionTrabajador.ACTIVO.value)


def test_pasivo_egresado_es_sin_asignacion_y_desactiva_su_cuenta(
    escenario, django_capture_on_commit_callbacks,
):
    emp = escenario['empleado'](CEDULA)
    asignacion = escenario['asignacion'](emp, escenario['tipo_pasivo'], escenario['activo'])
    cuenta = CuentaModel.objects.create(cedula=emp, rol=escenario['rol'], password='!')

    # Mismo recorrido que hace la pantalla: egresa el pasivo y corre el ciclo de vida al confirmar.
    with django_capture_on_commit_callbacks(execute=True):
        RepoPasivosORM().egresar_pasivo(
            CEDULA, escenario['motivo'].pk, usuario_id=escenario['operador_id'],
        )

    asignacion.refresh_from_db()
    cuenta.refresh_from_db()
    assert asignacion.estatusid.estatus == 'EGRESADO'
    assert RepoCondicionTrabajadorORM().condicion_por_cedula(CEDULA) is CondicionTrabajador.SIN_ASIGNACION
    assert cuenta.is_active is False
    assert DesactivacionEgresoModel.objects.filter(cuenta_id=cuenta.pk).exists()


def test_pasivo_egresado_con_asignacion_activa_es_activo(escenario):
    emp = escenario['empleado'](CEDULA)
    escenario['asignacion'](emp, escenario['tipo_pasivo'], escenario['egresado'])
    escenario['asignacion'](emp, escenario['tipo_activo'], escenario['activo'])
    repo = RepoCondicionTrabajadorORM()

    assert repo.condicion_por_cedula(CEDULA) is CondicionTrabajador.ACTIVO
    assert CEDULA in repo.cedulas_por_condicion(CondicionTrabajador.ACTIVO.value)
    assert CEDULA not in repo.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)


def test_pasivo_reincorporado_vuelve_a_ser_pasivo(escenario):
    emp = escenario['empleado'](CEDULA)
    escenario['asignacion'](emp, escenario['tipo_pasivo'], escenario['egresado'])
    escenario['asignacion'](emp, escenario['tipo_pasivo'], escenario['activo'])
    repo = RepoCondicionTrabajadorORM()

    assert repo.condicion_por_cedula(CEDULA) is CondicionTrabajador.PASIVO
    assert CEDULA in repo.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)


def test_pasivo_legado_sin_asignacion_sigue_siendo_pasivo(escenario):
    emp = escenario['empleado'](CEDULA_LEGADO)
    EmployeeEgresadoModel.objects.create(
        employee=emp, n_contrato='LEGADO', fechaingresoorganismo=datetime.date(2020, 1, 1),
        motivo_egreso=escenario['motivo'],
    )
    repo = RepoCondicionTrabajadorORM()

    assert repo.condicion_por_cedula(CEDULA_LEGADO) is CondicionTrabajador.PASIVO
    assert CEDULA_LEGADO in repo.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)


def test_empleado_legado_con_asignacion_activa_es_activo(escenario):
    """El registro legado no debe pisar una asignación activa vigente (condición y filtros coinciden)."""
    emp = escenario['empleado'](CEDULA_LEGADO)
    EmployeeEgresadoModel.objects.create(
        employee=emp, n_contrato='LEGADO', fechaingresoorganismo=datetime.date(2020, 1, 1),
        motivo_egreso=escenario['motivo'],
    )
    escenario['asignacion'](emp, escenario['tipo_activo'], escenario['activo'])
    repo = RepoCondicionTrabajadorORM()

    assert repo.condicion_por_cedula(CEDULA_LEGADO) is CondicionTrabajador.ACTIVO
    assert CEDULA_LEGADO in repo.cedulas_por_condicion(CondicionTrabajador.ACTIVO.value)
    assert CEDULA_LEGADO not in repo.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)
