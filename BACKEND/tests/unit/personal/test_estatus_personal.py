"""
Tests unitarios de los Value Objects de estatus/tipo de personal (R-04).

Puros, sin BD.
"""
from apps.personal.shared.domain.value_objects.estatus_personal import (
    EstatusAsignacion,
    TipoPersonal,
    ESTATUS_PERMITIDOS,
    ESTATUS_PERMITIDOS_EGRESOS,
)


def test_estatus_asignacion_es_comparable_como_string():
    assert EstatusAsignacion.ACTIVO == "ACTIVO"
    assert EstatusAsignacion.VACANTE.value == "VACANTE"
    assert EstatusAsignacion.VENCIDO.value == "VENCIDO"
    assert EstatusAsignacion.POR_VENCER.value == "POR VENCER"


def test_tipo_personal_es_comparable_como_string():
    assert TipoPersonal.ACTIVO == "ACTIVO"
    assert TipoPersonal.PASIVO == "PASIVO"


def test_listas_de_estatus_permitidos_preservan_valores_legados():
    assert ESTATUS_PERMITIDOS == ["SUSPENDIDO", "BLOQUEADO", "ACTIVO"]
    assert ESTATUS_PERMITIDOS_EGRESOS == ["PASIVO", "EGRESADO"]
