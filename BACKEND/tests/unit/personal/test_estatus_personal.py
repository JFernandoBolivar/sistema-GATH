"""
Tests unitarios de los Value Objects de estatus/tipo de personal (R-04).

Puros, sin BD: verifican tanto los VOs nuevos como la compatibilidad hacia
atrás de `RAC/utils/constants.py` (mismos valores string que el legado).
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


def test_compatibilidad_hacia_atras_rac_utils_constants():
    """RAC/utils/constants.py debe seguir exponiendo strings planos idénticos."""
    from RAC.utils import constants

    assert constants.ESTATUS_ACTIVO == "ACTIVO"
    assert constants.ESTATUS_VACANTE == "VACANTE"
    assert constants.ESTATUS_VENCIDO == "VENCIDO"
    assert constants.ESTATUS_POR_VENCER == "POR VENCER"
    assert constants.PERSONAL_ACTIVO == "ACTIVO"
    assert constants.PERSONAL_PASIVO == "PASIVO"
    assert isinstance(constants.ESTATUS_ACTIVO, str) and not isinstance(constants.ESTATUS_ACTIVO, EstatusAsignacion)
    assert constants.ESTATUS_PERMITIDOS == ESTATUS_PERMITIDOS
    assert constants.ESTATUS_PERMITIDOS_EGRESOS == ESTATUS_PERMITIDOS_EGRESOS
