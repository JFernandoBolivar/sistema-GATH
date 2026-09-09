from datetime import date

from django.test import TestCase
from rest_framework import serializers as drf_serializers

from RAC.models.personal_models import (
    Employee, Sexo, OrganismoAdscrito, antecedentes_servicio,
)
from RAC.serializers.personal_activo_serializers import EmployeeCreateUpdateSerializer


class ValidateAntecedentesTests(TestCase):

    def setUp(self):
        self.sexo = Sexo.objects.create(sexo="MASCULINO")
        self.organismo = OrganismoAdscrito.objects.create(Organismoadscrito="CONATEL")
        self.organismo_otro = OrganismoAdscrito.objects.create(Organismoadscrito="OTRO ORGANISMO")
        self.empleado = Employee.objects.create(
            cedulaidentidad="V-22222222",
            nombres="MARIA",
            apellidos="GOMEZ",
            sexoid=self.sexo,
        )
        self.existente = antecedentes_servicio.objects.create(
            empleado_id=self.empleado,
            organismo_id=self.organismo,
            fecha_ingreso=date(2018, 1, 1),
            fecha_egreso=date(2019, 12, 31),
        )
        self.serializer = EmployeeCreateUpdateSerializer(instance=self.empleado)

    def test_existente_con_id_sin_cambios_mas_nuevo_no_solapado_pasa(self):
        value = [
            {
                'id': self.existente.id,
                'organismo_id': self.organismo,
                'fecha_ingreso': date(2018, 1, 1),
                'fecha_egreso': date(2019, 12, 31),
            },
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2021, 1, 1),
                'fecha_egreso': date(2021, 6, 30),
            },
        ]
        resultado = self.serializer.validate_antecedentes(value)
        self.assertEqual(resultado, value)

    def test_existente_sin_id_sin_cambios_mas_nuevo_no_solapado_pasa(self):
        # Antes de la correccion esto fallaba con "se solapa consigo mismo"
        # porque no habia forma de reconocer que el item representa el mismo
        # registro que ya esta en la base de datos.
        value = [
            {
                'organismo_id': self.organismo,
                'fecha_ingreso': date(2018, 1, 1),
                'fecha_egreso': date(2019, 12, 31),
            },
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2021, 1, 1),
                'fecha_egreso': date(2021, 6, 30),
            },
        ]
        resultado = self.serializer.validate_antecedentes(value)
        self.assertEqual(resultado, value)

    def test_solapamiento_real_con_existente_sigue_lanzando_error(self):
        value = [
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2019, 6, 1),
                'fecha_egreso': date(2020, 6, 30),
            },
        ]
        with self.assertRaises(drf_serializers.ValidationError):
            self.serializer.validate_antecedentes(value)

    def test_solapamiento_real_entre_items_nuevos_sigue_lanzando_error(self):
        value = [
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2022, 1, 1),
                'fecha_egreso': date(2022, 6, 30),
            },
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2022, 5, 1),
                'fecha_egreso': date(2022, 8, 31),
            },
        ]
        with self.assertRaises(drf_serializers.ValidationError):
            self.serializer.validate_antecedentes(value)

    def test_fecha_egreso_anterior_a_ingreso_lanza_error(self):
        value = [
            {
                'organismo_id': self.organismo_otro,
                'fecha_ingreso': date(2022, 6, 30),
                'fecha_egreso': date(2022, 1, 1),
            },
        ]
        with self.assertRaises(drf_serializers.ValidationError):
            self.serializer.validate_antecedentes(value)
