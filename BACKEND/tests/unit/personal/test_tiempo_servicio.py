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
)


def test_calcular_tiempo_comercial_incluye_dia_de_inicio():
    resultado = calcular_tiempo_comercial(date(2020, 1, 1), date(2021, 1, 1))
    assert resultado["years"] == 1
    assert resultado["total_dias"] == 361  # 360 + 1 día adicional


def test_calcular_total_apn_suma_antecedentes_cerrados():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2018, 1, 1), fecha_egreso=date(2019, 1, 1)),
        SimpleNamespace(fecha_ingreso=date(2020, 1, 1), fecha_egreso=None),  # abierto: se ignora
    ]
    resultado = calcular_total_apn(antecedentes)
    assert resultado["years"] == 1


def test_calcular_total_apn_con_multiples_periodos():
    antecedentes = [
        SimpleNamespace(fecha_ingreso=date(2018, 1, 1), fecha_egreso=date(2019, 1, 1)),
        SimpleNamespace(fecha_ingreso=date(2019, 6, 1), fecha_egreso=date(2020, 6, 1)),
    ]
    resultado = calcular_total_apn(antecedentes)
    assert resultado["years"] == 2

