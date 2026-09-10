from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase

from RAC.utils.tiempo_servicio import calcular_tiempo_comercial, calcular_total_apn


def _ant(ingreso, egreso):
    return SimpleNamespace(fecha_ingreso=ingreso, fecha_egreso=egreso)


class CalcularTiempoComercialTests(SimpleTestCase):

    def test_mismo_dia(self):
        # Abril tiene 30 dias: el dia inclusivo se suma normalmente.
        resultado = calcular_tiempo_comercial(date(2021, 4, 10), date(2021, 4, 10))
        self.assertEqual(resultado["total_dias"], 1)
        self.assertEqual(resultado["years"], 0)
        self.assertEqual(resultado["months"], 0)
        self.assertEqual(resultado["days"], 1)

    def test_mismo_dia_mes_de_31_dias(self):
        # Marzo tiene 31 dias: no se suma el dia inclusivo.
        resultado = calcular_tiempo_comercial(date(2021, 3, 10), date(2021, 3, 10))
        self.assertEqual(resultado["total_dias"], 0)
        self.assertEqual(resultado["years"], 0)
        self.assertEqual(resultado["months"], 0)
        self.assertEqual(resultado["days"], 0)

    def test_cruce_de_mes_con_dia_31(self):
        # Egreso en junio (30 dias): se suma el dia inclusivo.
        resultado = calcular_tiempo_comercial(date(2021, 5, 31), date(2021, 6, 15))
        self.assertEqual(resultado["total_dias"], 16)

    def test_fin_de_febrero_bisiesto(self):
        # Egreso en febrero (<=30 dias): se suma el dia inclusivo.
        resultado = calcular_tiempo_comercial(date(2020, 1, 31), date(2020, 2, 29))
        self.assertEqual(resultado["total_dias"], 30)

    def test_mes_completo_31_dias(self):
        # Egreso en enero (31 dias): no se suma el dia inclusivo, queda en
        # 29 dias en vez de un mes comercial exacto de 30.
        resultado = calcular_tiempo_comercial(date(2020, 1, 1), date(2020, 1, 31))
        self.assertEqual(resultado["total_dias"], 29)

    def test_mes_completo_30_dias(self):
        # Egreso en abril (30 dias): si se suma el dia inclusivo, un mes
        # calendario completo si da un mes comercial exacto de 30 dias.
        resultado = calcular_tiempo_comercial(date(2021, 4, 1), date(2021, 4, 30))
        self.assertEqual(resultado["total_dias"], 30)

    def test_caso_confirmado_egreso_en_mes_de_30_dias(self):
        # Caso de referencia confirmado por el usuario: 11/04/2010 -> 14/11/2013.
        # Egreso en noviembre (30 dias): se suma el dia inclusivo.
        resultado = calcular_tiempo_comercial(date(2010, 4, 11), date(2013, 11, 14))
        self.assertEqual(resultado["total_dias"], 1294)
        self.assertEqual(resultado["years"], 3)
        self.assertEqual(resultado["months"], 7)
        self.assertEqual(resultado["days"], 4)

    def test_caso_confirmado_egreso_en_mes_de_31_dias(self):
        # Caso de referencia confirmado por el usuario: 12/11/2012 -> 01/03/2018.
        # Egreso en marzo (31 dias): NO se suma el dia inclusivo.
        resultado = calcular_tiempo_comercial(date(2012, 11, 12), date(2018, 3, 1))
        self.assertEqual(resultado["total_dias"], 1909)
        self.assertEqual(resultado["years"], 5)
        self.assertEqual(resultado["months"], 3)
        self.assertEqual(resultado["days"], 19)


class CalcularTotalApnTests(SimpleTestCase):

    def test_antecedentes_contiguos_con_frontera_compartida_se_fusionan(self):
        # El egreso del primero coincide con el ingreso del segundo: deben
        # fusionarse en un solo periodo y NO contar el dia frontera dos veces.
        # El periodo fusionado egresa en diciembre (31 dias), por lo que no
        # lleva el dia inclusivo: un año calendario completo (01/01-31/12)
        # queda en 359 dias, no en 360 exactos.
        antecedentes = [
            _ant(date(2020, 1, 1), date(2020, 6, 30)),
            _ant(date(2020, 6, 30), date(2020, 12, 31)),
        ]
        resultado = calcular_total_apn(antecedentes)
        total_dias = resultado["years"] * 360 + resultado["months"] * 30 + resultado["days"]
        self.assertEqual(total_dias, 359)
        self.assertEqual(resultado["years"], 0)
        self.assertEqual(resultado["months"], 11)
        self.assertEqual(resultado["days"], 29)

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
        # Egreso en enero (31 dias): no lleva el dia inclusivo, queda en 29.
        antecedentes = [
            _ant(date(2020, 1, 1), date(2020, 1, 31)),
            _ant(date(2021, 1, 1), None),
        ]
        resultado = calcular_total_apn(antecedentes)
        total_dias = resultado["years"] * 360 + resultado["months"] * 30 + resultado["days"]
        self.assertEqual(total_dias, 29)
