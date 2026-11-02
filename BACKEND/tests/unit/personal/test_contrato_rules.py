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


# --- validar_registro_contrato (validaciones de carga masiva, Fase 2) ---
from apps.personal.shared.domain.services.contrato_rules import (  # noqa: E402
    MAXIMO_CONTRATOS,
    ContratoRegistrado,
    validar_registro_contrato,
)

HOY = date(2026, 10, 21)


def _c(n, ingreso, culminacion, es_fijo=False):
    return ContratoRegistrado(n_contrato=n, es_fijo=es_fijo, fecha_ingreso=ingreso, fecha_culminacion=culminacion)


def _validar(existentes, n, ingreso, culminacion, egresado=False):
    return validar_registro_contrato(existentes, n, ingreso, culminacion, hoy=HOY, egresado=egresado)


def test_primer_contrato_es_valido():
    assert _validar([], 'C-1-01', date(2024, 1, 1), date(2024, 12, 31)) is None


def test_historial_consecutivo_hasta_el_tercero_es_valido():
    previos = [_c('C-1-01', date(2022, 1, 1), date(2022, 12, 31)), _c('C-1-02', date(2023, 1, 1), date(2023, 12, 31))]
    assert _validar(previos, 'C-1-03', date(2024, 1, 1), None) is None


def test_bloquea_contrato_nuevo_si_ya_hay_fijo():
    previos = [_c('C-1-03', date(2024, 1, 1), None, es_fijo=True)]
    error = _validar(previos, 'C-1-04', date(2025, 1, 1), None)
    assert 'FIJO' in error and 'C-1-03' in error


def test_bloquea_modificar_contrato_fijo():
    previos = [_c('C-1-03', date(2024, 1, 1), None, es_fijo=True)]
    assert 'FIJO' in _validar(previos, 'C-1-03', date(2024, 6, 1), None)


def test_recargar_fila_identica_de_contrato_fijo_no_falla():
    # Volver a importar el mismo expediente no debe romper la carga.
    previos = [_c('C-1-03', date(2024, 1, 1), None, es_fijo=True)]
    assert _validar(previos, 'C-1-03', date(2024, 1, 1), date(2024, 12, 31)) is None


def test_bloquea_superar_el_maximo_de_contratos():
    previos = [_c(f'C-1-0{i}', date(2019 + i, 1, 1), date(2019 + i, 6, 30)) for i in range(1, MAXIMO_CONTRATOS + 1)]
    error = _validar(previos, 'C-1-04', date(2025, 1, 1), date(2025, 6, 30))
    assert f'máximo {MAXIMO_CONTRATOS}' in error


def test_bloquea_contrato_nuevo_con_otro_activo():
    previos = [_c('C-1-01', date(2026, 1, 1), date(2026, 12, 31))]
    error = _validar(previos, 'C-1-02', date(2027, 1, 1), None)
    assert 'contrato activo (C-1-01)' in error


def test_bloquea_culminacion_anterior_al_ingreso():
    error = _validar([], 'C-1-01', date(2024, 6, 1), date(2024, 1, 1))
    assert 'no puede ser anterior' in error


def test_bloquea_solapamiento_al_actualizar():
    previos = [_c('C-1-01', date(2022, 1, 1), date(2022, 12, 31)), _c('C-1-02', date(2023, 1, 1), date(2023, 12, 31))]
    error = _validar(previos, 'C-1-02', date(2022, 6, 1), date(2023, 12, 31))
    assert 'se solapa con el contrato C-1-01' in error


def test_empleado_egresado_puede_registrar_contratos():
    previos = [_c('C-1-03', date(2024, 1, 1), None, es_fijo=True)]
    assert _validar(previos, 'C-1-04', date(2026, 1, 1), None, egresado=True) is None
