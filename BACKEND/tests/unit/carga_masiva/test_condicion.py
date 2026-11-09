"""Detección y confirmación puras del cambio de condición (FIX-CARGA1)."""
import pytest

from apps.carga_masiva.domain.condicion import (
    CAMPOS_REQUERIDOS_POR_DIRECCION,
    DireccionCambio,
    Poblacion,
    campos_faltantes,
    direccion_cambio,
    puede_aplicarse,
    puede_confirmarse,
    requiere_confirmacion,
)


@pytest.mark.parametrize(
    ('condicion', 'poblacion', 'esperado'),
    [
        ('ACTIVO', 'PASIVOS', DireccionCambio.ACTIVO_A_PASIVO),
        ('PASIVO', 'ACTIVOS', DireccionCambio.PASIVO_A_ACTIVO),
        ('ACTIVO', 'ACTIVOS', None),
        ('PASIVO', 'PASIVOS', None),
        ('SIN_ASIGNACION', 'ACTIVOS', None),
        ('SIN_ASIGNACION', 'PASIVOS', None),
    ],
)
def test_direccion_cambio(condicion, poblacion, esperado):
    assert direccion_cambio(condicion, poblacion) is esperado


def test_poblacion_invalida():
    with pytest.raises(ValueError):
        direccion_cambio('ACTIVO', 'OTRA')


def test_requiere_confirmacion_solo_con_condicion_opuesta():
    assert requiere_confirmacion('ACTIVO', Poblacion.PASIVOS) is True
    assert requiere_confirmacion('PASIVO', Poblacion.ACTIVOS) is True
    assert requiere_confirmacion('ACTIVO', Poblacion.ACTIVOS) is False
    assert requiere_confirmacion(None, Poblacion.PASIVOS) is False


def test_campos_faltantes_activo_a_pasivo():
    assert campos_faltantes(DireccionCambio.ACTIVO_A_PASIVO.value, {}) == (
        'fecha_egreso', 'motivo_id', 'tipo_nomina_id',
    )
    assert campos_faltantes(
        DireccionCambio.ACTIVO_A_PASIVO.value,
        {'fecha_egreso': '2026-01-01', 'motivo_id': 1, 'tipo_nomina_id': 2},
    ) == ()


def test_campos_faltantes_pasivo_a_activo():
    assert campos_faltantes(DireccionCambio.PASIVO_A_ACTIVO.value, {}) == (
        'fecha_ingreso', 'motivo_id',
    )


def test_mapa_de_campos_requeridos_cubre_las_dos_direcciones():
    assert set(CAMPOS_REQUERIDOS_POR_DIRECCION) == {
        DireccionCambio.ACTIVO_A_PASIVO.value,
        DireccionCambio.PASIVO_A_ACTIVO.value,
    }


def test_puede_confirmarse_exige_movimiento_completo():
    incompleto = {
        'completo': False,
        'faltantes': ['fecha_egreso', 'motivo_id'],
    }
    completo = {'completo': True, 'faltantes': []}
    assert puede_confirmarse('REQUIERE_CONFIRMACION', incompleto) == (
        False, 'Complete los datos del movimiento: fecha_egreso, motivo_id.',
    )
    assert puede_confirmarse('REQUIERE_CONFIRMACION', completo) == (True, '')
    assert puede_confirmarse('ERROR', completo)[0] is False
    assert puede_confirmarse('REQUIERE_CONFIRMACION', None)[0] is False


def test_sin_confirmar_no_se_aplica():
    assert puede_aplicarse('REQUIERE_CONFIRMACION', False) is False
    assert puede_aplicarse('REQUIERE_CONFIRMACION', True) is True
    assert puede_aplicarse('ACTUALIZAR', False) is True
    assert puede_aplicarse('ERROR', True) is False
    assert puede_aplicarse('SIN_CAMBIOS', True) is False
