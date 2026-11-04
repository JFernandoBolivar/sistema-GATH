"""El listado de Gestión de personal activo (cargos y vacantes) no muestra los puestos de pasivos."""
import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    TipoNominaModel,
    TipoPersonalModel,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def puestos(db):
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='EMPLEADO')
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    comun = dict(denominacioncargoid=dc, denominacioncargoespecificoid=dce, tiponominaid=nomina, estatusid=estatus)
    AsigTrabajoModel.objects.create(codigo='C-ACT-1', Tipo_personal=activo, **comun)
    AsigTrabajoModel.objects.create(codigo='P_0028', Tipo_personal=pasivo, **comun)


def test_listado_excluye_puestos_de_pasivos(puestos):
    codigos = {c.codigo for c in RepoCargosORM().listar_cargos()}
    assert 'C-ACT-1' in codigos
    assert 'P_0028' not in codigos


def test_vacantes_excluye_puestos_de_pasivos(puestos):
    codigos = {c.codigo for c in RepoCargosORM().listar_cargos(solo_vacantes=True)}
    assert codigos == {'C-ACT-1'}
