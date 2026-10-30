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
    nomina = TipoNominaModel.objects.create(nomina='PENSIONADOS SOBREVIVIENTES')
    fallec = TipoMovimientoModel.objects.create(movimiento='FALLECIMIENTO')
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
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
    return {'nomina': nomina, 'fam': fam}


def test_crea_employee_asignacion_pasivo_y_copia_perfil_e_idempotente(escenario):
    dto = CrearSobrevivientesDTO(cedula_titular='V1000', tipo_nomina_id=escenario['nomina'].pk)
    res = ejecutar_creacion_sobrevivientes(RepoPasivosORM(), dto)

    assert [(r.cedula, r.creado) for r in res] == [('V2000', True)]
    emp = EmployeeModel.objects.get(cedulaidentidad='V2000')
    assert emp.nombres == 'Ana'
    asig = AsigTrabajoModel.objects.get(employee=emp)
    assert asig.Tipo_personal.tipo_personal == 'PASIVO'
    assert 'PENSION_SOBREVIVIENTE' in asig.observaciones and 'V1000' in asig.observaciones
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
