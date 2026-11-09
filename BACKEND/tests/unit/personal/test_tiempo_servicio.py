"""
Tests unitarios del cálculo de tiempo de servicio / APN (R-05).

Puros, sin BD. Cubren tanto la nueva ubicación compartida como el re-export
de compatibilidad en `RAC/utils/tiempo_servicio.py`.
"""
from datetime import date
from types import SimpleNamespace

from apps.personal.shared.domain.services.tiempo_servicio import (
    calcular_tiempo_comercial,
    calcular_total_apn,
    formatear_tiempo_servicio,
)


def test_egreso_en_mes_de_31_dias_no_suma_dia_inclusivo():
    resultado = calcular_tiempo_comercial(date(2020, 1, 1), date(2021, 1, 1))
    assert resultado["years"] == 1
    assert resultado["total_dias"] == 360  # enero tiene 31 días: sin día inclusivo


def test_calcular_total_apn_suma_antecedentes_cerrados():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2018, 1, 1), fecha_egreso=date(2019, 1, 1)),
        SimpleNamespace(fecha_ingreso=date(2020, 1, 1), fecha_egreso=None),  # abierto: se ignora
    ]
    resultado = calcular_total_apn(antecedentes)
    assert resultado["years"] == 1


def test_calcular_total_apn_incluye_periodo_en_curso_hasta_la_fecha_de_corte():
    antecedentes = [
        # 3 años previos cerrados (enero: sin día inclusivo => 1080 días).
        SimpleNamespace(fecha_ingreso=date(2010, 1, 1), fecha_egreso=date(2013, 1, 1)),
        # CONATEL en curso: 4a 5m 20d hasta el 20/06/2018 (junio suma día inclusivo).
        SimpleNamespace(fecha_ingreso=date(2014, 1, 1), fecha_egreso=None),
    ]
    resultado = calcular_total_apn(antecedentes, fecha_corte=date(2018, 6, 20))
    assert (resultado['years'], resultado['months'], resultado['days']) == (7, 5, 20)
    assert resultado['antecedentes'] == {'years': 3, 'months': 0, 'days': 0}
    assert (resultado['en_curso']['years'], resultado['en_curso']['months'], resultado['en_curso']['days']) == (4, 5, 20)
    assert resultado['completo'] is True


def test_calcular_total_apn_sin_fecha_de_ingreso_queda_incompleto():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2010, 1, 1), fecha_egreso=date(2013, 1, 1)),
    ]
    resultado = calcular_total_apn(antecedentes, fecha_corte=date(2026, 1, 1))
    assert resultado['years'] == 3
    assert resultado['en_curso'] is None
    assert resultado['completo'] is False


def test_calcular_total_apn_fusiona_el_periodo_en_curso_con_los_cerrados():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2010, 1, 1), fecha_egreso=date(2014, 1, 1)),
        SimpleNamespace(fecha_ingreso=date(2014, 1, 1), fecha_egreso=date(2018, 1, 1)),
    ]
    resultado = calcular_total_apn(antecedentes, fecha_corte=date(2018, 1, 1))
    assert (resultado['years'], resultado['months'], resultado['days']) == (8, 0, 0)


def test_calcular_total_apn_sin_fecha_de_corte_conserva_solo_cerrados():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2010, 1, 1), fecha_egreso=date(2013, 1, 1)),
        SimpleNamespace(fecha_ingreso=date(2014, 1, 1), fecha_egreso=None),
    ]
    assert calcular_total_apn(antecedentes) == {'years': 3, 'months': 0, 'days': 0}


def test_calcular_total_apn_con_multiples_periodos():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2018, 1, 1), fecha_egreso=date(2019, 1, 1)),
        SimpleNamespace(fecha_ingreso=date(2019, 6, 1), fecha_egreso=date(2020, 6, 1)),
    ]
    resultado = calcular_total_apn(antecedentes)
    assert resultado["years"] == 2



# Casos de referencia entregados por RRHH (2026-11-03).

def test_rrhh_caso_1_egreso_en_marzo():
    r = calcular_tiempo_comercial(date(2012, 11, 12), date(2018, 3, 1))
    assert (r["years"], r["months"], r["days"], r["total_dias"]) == (5, 3, 19, 1909)


def test_rrhh_caso_2_egreso_en_noviembre_suma_dia_inclusivo():
    r = calcular_tiempo_comercial(date(2010, 4, 11), date(2013, 11, 14))
    assert (r["years"], r["months"], r["days"], r["total_dias"]) == (3, 7, 4, 1294)


def test_rrhh_periodos_solapados_se_fusionan():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2012, 11, 12), fecha_egreso=date(2018, 3, 1)),
        SimpleNamespace(fecha_ingreso=date(2010, 4, 11), fecha_egreso=date(2013, 11, 14)),
    ]
    assert calcular_total_apn(antecedentes) == {"years": 7, "months": 10, "days": 20}


def test_dia_31_se_ajusta_a_30():
    r = calcular_tiempo_comercial(date(2020, 1, 31), date(2020, 3, 31))
    assert r["total_dias"] == 60  # (3-1)*30 + (30-30) + 0


def test_periodos_contiguos_no_duplican_la_fecha_frontera():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2018, 1, 1), fecha_egreso=date(2018, 6, 30)),
        SimpleNamespace(fecha_ingreso=date(2018, 6, 30), fecha_egreso=date(2018, 12, 31)),
    ]
    # Se fusionan en 01/01/2018-31/12/2018: 11*30 + 29 + 0 = 359.
    assert calcular_total_apn(antecedentes) == {"years": 0, "months": 11, "days": 29}


def test_formatear_tiempo_servicio_dias_y_meses_sin_decimales():
    # 0.0082 años ≈ 3 días (el caso reportado en pantalla).
    assert formatear_tiempo_servicio(0.0082) == '3 días de servicio en APN'
    assert formatear_tiempo_servicio(0.0028) == '1 día de servicio en APN'
    assert formatear_tiempo_servicio(0.25) == '2 meses y 30 días de servicio en APN'
    assert '0.' not in formatear_tiempo_servicio(0.25)


def test_formatear_tiempo_servicio_anios_y_meses():
    assert formatear_tiempo_servicio(1.0) == '1 año de servicio en APN'
    assert formatear_tiempo_servicio(15.0) == '15 años de servicio en APN'
    assert formatear_tiempo_servicio(1.5) == '1 año y 6 meses de servicio en APN'
    assert formatear_tiempo_servicio(5.25) == '5 años y 3 meses de servicio en APN'
    assert formatear_tiempo_servicio(None) == '0 días de servicio en APN'
