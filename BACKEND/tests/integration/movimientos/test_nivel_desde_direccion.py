"""El Nivel de un código se deriva de su Dirección General al registrar un movimiento."""
import pytest

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from core.domain.exceptions import ValidationError
from tests.integration.carga_masiva.test_cambio_condicion import (  # noqa: F401  (fixture)
    _cargo,
    _empleado,
    escenario,
)

pytestmark = pytest.mark.django_db


def test_sin_nivel_pero_con_direccion_general_toma_el_nivel_de_la_direccion(escenario):
    cargo = _cargo('NIV-01', escenario, escenario['tipo_activo'], escenario['estatus_activo'])
    AsigTrabajoModel.objects.filter(pk=cargo.pk).update(Dependencia=None)
    _empleado('81000001', escenario)

    RepoMovimientosORM().registrar_movimiento(
        cargo_id=cargo.pk, cedula='81000001', tipo_movimiento='INGRESO',
        motivo_id=None, usuario_id=escenario['cuenta'].pk,
    )

    cargo.refresh_from_db()
    assert cargo.Dependencia_id == escenario['dependencia'].pk


def test_sin_ninguna_ubicacion_explica_que_falta_el_nivel(escenario):
    cargo = _cargo('NIV-02', escenario, escenario['tipo_activo'], escenario['estatus_activo'])
    AsigTrabajoModel.objects.filter(pk=cargo.pk).update(Dependencia=None, DireccionGeneral=None)
    _empleado('81000002', escenario)

    with pytest.raises(ValidationError) as error:
        RepoMovimientosORM().registrar_movimiento(
            cargo_id=cargo.pk, cedula='81000002', tipo_movimiento='INGRESO',
            motivo_id=None, usuario_id=escenario['cuenta'].pk,
        )
    assert 'no tiene Nivel asignado' in str(error.value)
    assert '(Dependencia)' not in str(error.value)
