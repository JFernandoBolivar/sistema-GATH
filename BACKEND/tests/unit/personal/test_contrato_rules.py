"""
Tests unitarios de las reglas puras de contrato (R-09).
Sin BD, sin Django: ejercitan directamente `contrato_rules.py`.
"""
from datetime import date, timedelta

from apps.personal.shared.domain.services.contrato_rules import (
    ClaveEstatusContrato,
    decidir_estatus_contrato,
    es_tercer_contrato,
    generar_numero_contrato,
)


def test_generar_numero_contrato_usa_inicial_politica_cedula_y_correlativo():
    assert generar_numero_contrato('CONTRATADO', '30540767', 1) == 'C-30540767-01'
    assert generar_numero_contrato('CONTRATADO', '30540767', 12) == 'C-30540767-12'


def test_generar_numero_contrato_sin_politica_usa_c_por_defecto():
    assert generar_numero_contrato('', '123', 1) == 'C-123-01'
    assert generar_numero_contrato(None, '123', 1) == 'C-123-01'


def test_decidir_estatus_contrato_fijo_siempre_activo():
    # Incluso con fecha de culminación vencida, un contrato fijo es ACTIVO.
    hoy = date(2026, 8, 24)
    resultado = decidir_estatus_contrato(es_fijo=True, fecha_culminacion=date(2020, 1, 1), hoy=hoy)
    assert resultado == ClaveEstatusContrato.ACTIVO


def test_decidir_estatus_contrato_sin_fecha_culminacion_es_activo():
    hoy = date(2026, 8, 24)
    assert decidir_estatus_contrato(False, None, hoy) == ClaveEstatusContrato.ACTIVO


def test_decidir_estatus_contrato_vencido_incluye_el_dia_mismo():
    hoy = date(2026, 8, 24)
    assert decidir_estatus_contrato(False, hoy, hoy) == ClaveEstatusContrato.VENCIDO
    assert decidir_estatus_contrato(False, hoy - timedelta(days=1), hoy) == ClaveEstatusContrato.VENCIDO


def test_decidir_estatus_contrato_por_vencer_dentro_de_30_dias():
    hoy = date(2026, 8, 24)
    assert decidir_estatus_contrato(False, hoy + timedelta(days=30), hoy) == ClaveEstatusContrato.POR_VENCER
    assert decidir_estatus_contrato(False, hoy + timedelta(days=1), hoy) == ClaveEstatusContrato.POR_VENCER


def test_decidir_estatus_contrato_activo_mas_alla_de_30_dias():
    hoy = date(2026, 8, 24)
    assert decidir_estatus_contrato(False, hoy + timedelta(days=31), hoy) == ClaveEstatusContrato.ACTIVO


def test_es_tercer_contrato_solo_si_es_nuevo_y_ya_tiene_dos():
    assert es_tercer_contrato(cantidad_actual=2, existe_previo=False) is True
    assert es_tercer_contrato(cantidad_actual=2, existe_previo=True) is False
    assert es_tercer_contrato(cantidad_actual=1, existe_previo=False) is False
