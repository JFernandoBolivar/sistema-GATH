from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase

from RAC.utils.tiempo_servicio import calcular_tiempo_comercial, calcular_total_apn


def _ant(ingreso, egreso):
    return SimpleNamespace(fecha_ingreso=ingreso, fecha_egreso=egreso)


class CalcularTiempoComercialTests(SimpleTestCase):

    def test_mismo_dia(self):
        resultado = calcular_tiempo_comercial(date(2021, 3, 10), date(2021, 3, 10))
        self.assertEqual(resultado["total_dias"], 1)
        self.assertEqual(resultado["years"], 0)
        self.assertEqual(resultado["months"], 0)
        self.assertEqual(resultado["days"], 1)

    def test_cruce_de_mes_con_dia_31(self):
        resultado = calcular_tiempo_comercial(date(2021, 5, 31), date(2021, 6, 15))
        self.assertEqual(resultado["total_dias"], 16)

    def test_fin_de_febrero_bisiesto(self):
        resultado = calcular_tiempo_comercial(date(2020, 1, 31), date(2020, 2, 29))
        self.assertEqual(resultado["total_dias"], 30)

    def test_mes_completo_31_dias(self):
        resultado = calcular_tiempo_comercial(date(2020, 1, 1), date(2020, 1, 31))
        self.assertEqual(resultado["total_dias"], 30)


class CalcularTotalApnTests(SimpleTestCase):

    def test_antecedentes_contiguos_con_frontera_compartida_se_fusionan(self):
        # El egreso del primero coincide con el ingreso del segundo: deben
        # fusionarse en un solo periodo y NO contar el dia frontera dos veces.
        antecedentes = [
            _ant(date(2020, 1, 1), date(2020, 6, 30)),
            _ant(date(2020, 6, 30), date(2020, 12, 31)),
        ]
        resultado = calcular_total_apn(antecedentes)
        total_dias = resultado["years"] * 360 + resultado["months"] * 30 + resultado["days"]
        self.assertEqual(total_dias, 360)
        self.assertEqual(resultado["years"], 1)
        self.assertEqual(resultado["months"], 0)
        self.assertEqual(resultado["days"], 0)

    def test_antecedentes_solapados_parcialmente_se_fusionan(self):
        antecedentes = [
            _ant(date(2020, 1, 1), date(2020, 6, 15)),
            _ant(date(2020, 5, 1), date(2020, 8, 31)),
        ]
        resultado = calcular_total_apn(antecedentes)
        esperado = calcular_tiempo_comercial(date(2020, 1, 1), date(2020, 8, 31))["total_dias"]
        total_dias = resultado["years"] * 360 + resultado["months"] * 30 + resultado["days"]
        self.assertEqual(total_dias, esperado)

    def test_antecedentes_con_gap_real_no_se_fusionan(self):
        antecedentes = [
            _ant(date(2020, 1, 1), date(2020, 3, 31)),
            _ant(date(2020, 5, 1), date(2020, 6, 30)),
        ]
        resultado = calcular_total_apn(antecedentes)
        esperado = (
            calcular_tiempo_comercial(date(2020, 1, 1), date(2020, 3, 31))["total_dias"]
            + calcular_tiempo_comercial(date(2020, 5, 1), date(2020, 6, 30))["total_dias"]
        )
        total_dias = resultado["years"] * 360 + resultado["months"] * 30 + resultado["days"]
        self.assertEqual(total_dias, esperado)

    def test_antecedentes_abiertos_se_ignoran(self):
        antecedentes = [
            _ant(date(2020, 1, 1), date(2020, 1, 31)),
            _ant(date(2021, 1, 1), None),
        ]
        resultado = calcular_total_apn(antecedentes)
        total_dias = resultado["years"] * 360 + resultado["months"] * 30 + resultado["days"]
        self.assertEqual(total_dias, 30)
