"""
Con qué condición y con qué plantilla se emite un carnet (seguimiento A-4).

Usa el resolutor de condición REAL (el mismo de autogestión y cuentas):
- Sin asignación vigente (egresado por abandono, renuncia…) no hay carnet ni vista previa.
- Un activo recibe la plantilla de «trabajador» y un pasivo la de «pasivo».
- Solo se emite con plantillas publicadas: un borrador activo o indicado se ignora o se rechaza.
"""
import datetime
import uuid

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db

DEFINICION = {'anverso': [], 'reverso': []}


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANA'})
    sexo = SexoModel.objects.create(sexo='F')
    MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    tipo_pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    tipo_activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='EMPLEADO FIJO', es_activo=True)
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    dg = DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )
    for codigo in ('trabajador', 'pasivo'):
        TipoCredencialModel.objects.get_or_create(codigo=codigo, defaults={'nombre': codigo.title()})

    def empleado(cedula, tipo=None):
        emp = EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres='ANA', apellidos='PRUEBA', sexoid=sexo, nacionalidad_id=1,
        )
        if tipo is not None:
            AsigTrabajoModel.objects.create(
                employee=emp, codigo=f'C-{uuid.uuid4().hex[:12]}',
                denominacioncargoid=dc, denominacioncargoespecificoid=dce, tiponominaid=nomina,
                estatusid=activo, Tipo_personal=tipo, Dependencia=dep, DireccionGeneral=dg,
            )
        return emp

    def plantilla(tipo, nombre, estado='publicada', activa=True, criterio=None):
        return PlantillaCarnetModel.objects.create(
            nombre=nombre, tipo_credencial_id=tipo, estado=estado, activa=activa, version=1,
            regla_criterio=criterio or ('nomina' if tipo == 'trabajador' else 'unico'), regla_valor='*',
            definicion=DEFINICION,
        )

    return {
        'empleado': empleado, 'plantilla': plantilla,
        'tipo_activo': tipo_activo, 'tipo_pasivo': tipo_pasivo,
    }


def test_sin_asignacion_no_se_emite_ni_se_previsualiza(escenario):
    escenario['empleado']('7700001')
    repo = RepoCarnetizacionORM()

    with pytest.raises(ValidationError, match='asignación vigente'):
        repo.emitir_carnet('7700001', 1)
    with pytest.raises(ValidationError, match='asignación vigente'):
        repo.generar_vista_previa('7700001')
    assert not CarnetEmitidoModel.objects.filter(employee_id='7700001').exists()


def test_egresado_por_abandono_no_recibe_carnet_de_jubilado(escenario):
    """Caso real: un egreso por abandono de cargo recibía la plantilla de pasivo."""
    emp = escenario['empleado']('7700002')
    cat = CategoriaMovimientoModel.objects.create(categoria='EGRESO')
    abandono = TipoMovimientoModel.objects.create(movimiento='ABANDONO DE CARGO', categoria=cat)
    EmployeeEgresadoModel.objects.create(
        employee=emp, n_contrato='X', fechaingresoorganismo=datetime.date(2020, 1, 1),
        motivo_egreso=abandono,
    )
    escenario['plantilla']('pasivo', 'Pasivos')

    with pytest.raises(ValidationError, match='asignación vigente'):
        RepoCarnetizacionORM().emitir_carnet('7700002', 1)


def test_activo_y_pasivo_reciben_la_plantilla_de_su_tipo(escenario):
    escenario['empleado']('7700003', escenario['tipo_activo'])
    escenario['empleado']('7700004', escenario['tipo_pasivo'])
    trabajador = escenario['plantilla']('trabajador', 'Activos')
    pasivo = escenario['plantilla']('pasivo', 'Pasivos')
    repo = RepoCarnetizacionORM()

    activo_emitido = CarnetEmitidoModel.objects.get(pk=repo.emitir_carnet('7700003', 1).id)
    pasivo_emitido = CarnetEmitidoModel.objects.get(pk=repo.emitir_carnet('7700004', 1).id)

    assert activo_emitido.plantilla_id == str(trabajador.id)
    assert pasivo_emitido.plantilla_id == str(pasivo.id)


def test_un_borrador_activo_no_se_usa_para_emitir(escenario):
    escenario['empleado']('7700005', escenario['tipo_activo'])
    publicada = escenario['plantilla']('trabajador', 'Publicada')
    # La regla genérica «todos/*» es la preferida: si los borradores no se filtraran, ganaría.
    escenario['plantilla']('trabajador', 'Borrador activo', estado='borrador', criterio='todos')

    emitido = CarnetEmitidoModel.objects.get(pk=RepoCarnetizacionORM().emitir_carnet('7700005', 1).id)

    assert emitido.plantilla_id == str(publicada.id)


def test_una_plantilla_en_borrador_indicada_se_rechaza(escenario):
    escenario['empleado']('7700006', escenario['tipo_activo'])
    borrador = escenario['plantilla']('trabajador', 'Borrador', estado='borrador', activa=False)

    with pytest.raises(ValidationError, match='publicadas'):
        RepoCarnetizacionORM().emitir_carnet('7700006', 1, plantilla_id=str(borrador.id))


def test_sin_plantilla_no_se_registra_una_version_falsa(escenario):
    escenario['empleado']('7700007', escenario['tipo_activo'])

    emitido = CarnetEmitidoModel.objects.get(pk=RepoCarnetizacionORM().emitir_carnet('7700007', 1).id)

    assert emitido.plantilla_id is None
    assert emitido.plantilla_version is None


def test_la_busqueda_informa_la_condicion_real(escenario):
    escenario['empleado']('7700008', escenario['tipo_activo'])
    escenario['empleado']('7700009', escenario['tipo_pasivo'])
    escenario['empleado']('7700010')
    repo = RepoCarnetizacionORM()

    condiciones = {f['cedula']: f['condicion'] for f in repo.buscar_personal('77000')}

    assert condiciones['7700008'] == 'ACTIVO'
    assert condiciones['7700009'] == 'PASIVO'
    assert condiciones['7700010'] == 'SIN_ASIGNACION'
