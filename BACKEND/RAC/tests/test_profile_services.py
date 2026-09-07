from datetime import date

from django.test import TestCase

from RAC.models.personal_models import (
    Employee, Sexo, OrganismoAdscrito, Estatus, politicas,
    antecedentes_servicio, contratos,
)
from RAC.services.profile_services import replace_antecedentes


class ReplaceAntecedentesTests(TestCase):

    def setUp(self):
        self.sexo = Sexo.objects.create(sexo="MASCULINO")
        self.organismo = OrganismoAdscrito.objects.create(Organismoadscrito="CONATEL")
        self.organismo_otro = OrganismoAdscrito.objects.create(Organismoadscrito="OTRO ORGANISMO")
        self.politica = politicas.objects.create(tipo_politica="CONTRATADO")
        self.estatus_activo = Estatus.objects.create(estatus="ACTIVO")
        self.empleado = Employee.objects.create(
            cedulaidentidad="V-11111111",
            nombres="JUAN",
            apellidos="PEREZ",
            sexoid=self.sexo,
        )

    def _crear_antecedente(self, ingreso, egreso, organismo=None):
        return antecedentes_servicio.objects.create(
            empleado_id=self.empleado,
            organismo_id=organismo or self.organismo,
            fecha_ingreso=ingreso,
            fecha_egreso=egreso,
        )

    def _crear_contrato(self, antecedente, n_contrato="C-11111111-01"):
        return contratos.objects.create(
            n_contrato=n_contrato,
            politica_id=self.politica,
            estatus_id=self.estatus_activo,
            antecedente_id=antecedente,
        )

    # ------------------------------------------------------------------
    # Caso protegido por contrato: debe actualizarse IN-PLACE
    # ------------------------------------------------------------------
    def test_antecedente_protegido_por_contrato_se_actualiza_in_place(self):
        ant = self._crear_antecedente(date(2020, 1, 1), date(2021, 1, 1))
        contrato = self._crear_contrato(ant)
        original_id = ant.id

        nuevo_ingreso = date(2020, 2, 1)
        nuevo_egreso = date(2021, 6, 30)
        replace_antecedentes(self.empleado, [{
            'id': ant.id,
            'organismo_id': self.organismo_otro,
            'fecha_ingreso': nuevo_ingreso,
            'fecha_egreso': nuevo_egreso,
        }])

        ant.refresh_from_db()
        contrato.refresh_from_db()

        self.assertEqual(ant.id, original_id)
        self.assertEqual(ant.fecha_ingreso, nuevo_ingreso)
        self.assertEqual(ant.fecha_egreso, nuevo_egreso)
        self.assertEqual(ant.organismo_id_id, self.organismo_otro.id)
        self.assertEqual(contrato.antecedente_id_id, original_id)
        self.assertEqual(
            antecedentes_servicio.objects.filter(empleado_id=self.empleado).count(),
            1,
            "No debe haberse creado un antecedente huerfano al actualizar uno protegido"
        )

    def test_antecedente_protegido_no_incluido_en_data_list_no_se_elimina(self):
        # Aunque el antecedente protegido no venga en el nuevo data_list,
        # no debe eliminarse porque un contrato lo referencia.
        ant = self._crear_antecedente(date(2020, 1, 1), date(2021, 1, 1))
        self._crear_contrato(ant)

        replace_antecedentes(self.empleado, [])

        self.assertTrue(antecedentes_servicio.objects.filter(id=ant.id).exists())

    # ------------------------------------------------------------------
    # Caso normal (sin contrato)
    # ------------------------------------------------------------------
    def test_antecedente_sin_contrato_sin_cambios_se_mantiene(self):
        ant = self._crear_antecedente(date(2019, 1, 1), date(2019, 12, 31))
        original_id = ant.id

        replace_antecedentes(self.empleado, [{
            'organismo_id': self.organismo,
            'fecha_ingreso': date(2019, 1, 1),
            'fecha_egreso': date(2019, 12, 31),
        }])

        ant.refresh_from_db()
        self.assertEqual(ant.id, original_id)
        self.assertEqual(
            antecedentes_servicio.objects.filter(empleado_id=self.empleado).count(), 1
        )

    def test_antecedente_sin_contrato_con_id_se_actualiza_in_place(self):
        ant = self._crear_antecedente(date(2019, 1, 1), date(2019, 12, 31))
        original_id = ant.id

        nuevo_egreso = date(2020, 3, 15)
        replace_antecedentes(self.empleado, [{
            'id': ant.id,
            'organismo_id': self.organismo,
            'fecha_ingreso': date(2019, 1, 1),
            'fecha_egreso': nuevo_egreso,
        }])

        ant.refresh_from_db()
        self.assertEqual(ant.id, original_id)
        self.assertEqual(ant.fecha_egreso, nuevo_egreso)
        self.assertEqual(
            antecedentes_servicio.objects.filter(empleado_id=self.empleado).count(), 1
        )

    def test_antecedente_sin_contrato_no_incluido_se_elimina(self):
        ant = self._crear_antecedente(date(2018, 1, 1), date(2018, 6, 30))

        replace_antecedentes(self.empleado, [])

        self.assertFalse(antecedentes_servicio.objects.filter(id=ant.id).exists())

    # ------------------------------------------------------------------
    # Creacion de un antecedente nuevo (sin 'id')
    # ------------------------------------------------------------------
    def test_antecedente_nuevo_sin_id_que_no_coincide_se_crea(self):
        existente = self._crear_antecedente(date(2015, 1, 1), date(2015, 12, 31))

        replace_antecedentes(self.empleado, [
            {
                'organismo_id': self.organismo,
                'fecha_ingreso': date(2015, 1, 1),
                'fecha_egreso': date(2015, 12, 31),
            },
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2022, 1, 1),
                'fecha_egreso': date(2022, 6, 30),
            },
        ])

        qs = antecedentes_servicio.objects.filter(empleado_id=self.empleado)
        self.assertEqual(qs.count(), 2)
        self.assertTrue(qs.filter(id=existente.id).exists())
        self.assertTrue(qs.filter(
            organismo_id=self.organismo_otro,
            fecha_ingreso=date(2022, 1, 1),
            fecha_egreso=date(2022, 6, 30),
        ).exists())

    def test_antecedente_nuevo_sin_id_que_coincide_con_existente_no_duplica(self):
        existente = self._crear_antecedente(date(2015, 1, 1), date(2015, 12, 31))

        # El item sin 'id' coincide exactamente (organismo/fechas) con el
        # existente -> debe reutilizarse, no crear un duplicado.
        replace_antecedentes(self.empleado, [{
            'organismo_id': self.organismo,
            'fecha_ingreso': date(2015, 1, 1),
            'fecha_egreso': date(2015, 12, 31),
        }])

        qs = antecedentes_servicio.objects.filter(empleado_id=self.empleado)
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs.first().id, existente.id)
