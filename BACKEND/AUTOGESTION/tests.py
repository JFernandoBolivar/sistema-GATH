from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from RAC.models.personal_models import Dependencias, Employee, DireccionGeneral, AsigTrabajo, Tipo_personal, Estatus, Denominacioncargo, Denominacioncargoespecifico, Sexo, Tiponomina
from AUTOGESTION.models.models_encuestas import PreguntasEncuestas, TipoPregunta, OpcionesPregunta, RespuestasEncuesta

User = get_user_model()

class CensoReportAPITests(APITestCase):
    def setUp(self):
        # Create master data
        self.tipo_personal = Tipo_personal.objects.create(tipo_personal="ACTIVO")
        self.estatus = Estatus.objects.create(estatus="ACTIVO")
        self.cargo = Denominacioncargo.objects.create(cargo="CARGO")
        self.cargo_esp = Denominacioncargoespecifico.objects.create(cargo="CARGO ESPECIAL")
        self.sexo = Sexo.objects.create(sexo="MASCULINO")
        self.tiponomina = Tiponomina.objects.create(nomina="NOMINA_PRUEBA")
        
        # Create some dependencies with unique Codigo
        self.dep1 = Dependencias.objects.create(id=10, dependencia="Dependencia de Prueba 1", Codigo="DEP10")
        self.dep2 = Dependencias.objects.create(id=11, dependencia="Dependencia de Prueba 2", Codigo="DEP11")
        
        self.dg1 = DireccionGeneral.objects.create(id=20, direccion_general="Direccion Gen 1", dependenciaId=self.dep1, Codigo="DG20")
        self.dg2 = DireccionGeneral.objects.create(id=21, direccion_general="Direccion Gen 2", dependenciaId=self.dep2, Codigo="DG21")

        # Create Employees
        self.emp1 = Employee.objects.create(cedulaidentidad="111111", nombres="Juan", apellidos="Perez", sexoid=self.sexo)
        self.emp2 = Employee.objects.create(cedulaidentidad="222222", nombres="Maria", apellidos="Gomez", sexoid=self.sexo)

        # Assignments
        AsigTrabajo.objects.create(
            codigo="ASIG-1",
            employee=self.emp1,
            denominacioncargoid=self.cargo,
            denominacioncargoespecificoid=self.cargo_esp,
            estatusid=self.estatus,
            Tipo_personal=self.tipo_personal,
            DireccionGeneral=self.dg1,
            Dependencia=self.dep1,
            tiponominaid=self.tiponomina
        )
        AsigTrabajo.objects.create(
            codigo="ASIG-2",
            employee=self.emp2,
            denominacioncargoid=self.cargo,
            denominacioncargoespecificoid=self.cargo_esp,
            estatusid=self.estatus,
            Tipo_personal=self.tipo_personal,
            DireccionGeneral=self.dg2,
            Dependencia=self.dep2,
            tiponominaid=self.tiponomina
        )

        # Survey setup
        self.tipo_preg = TipoPregunta.objects.create(nombre="cerrada")
        self.preg = PreguntasEncuestas.objects.create(enunciado="¿Pregunta de prueba?", tipo=self.tipo_preg, orden=1, activo=True)
        self.opt = OpcionesPregunta.objects.create(pregunta=self.preg, tipo_opcion="SÍ", orden=1)

        # emp1 has answered
        RespuestasEncuesta.objects.create(pregunta=self.preg, empleado=self.emp1, opcion=self.opt)

        # Create User and authenticate
        self.user = User.objects.create_user(cedula=self.emp1, password="password123")
        self.client.force_authenticate(user=self.user)

        self.url = reverse("AUTOGESTION:reporte-censo-dependencias")

    def test_get_report_without_params(self):
        """No parameters passed should return all dependencies aggregated."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        
        # Check pie chart structure: 1 answered, 1 not answered
        pie_data = response.data["data"]["pie_chart"]
        self.assertEqual(len(pie_data), 2)
        self.assertEqual(pie_data[0]["name"], "Respondido")
        self.assertEqual(pie_data[0]["value"], 1)
        self.assertEqual(pie_data[1]["name"], "No Respondido")
        self.assertEqual(pie_data[1]["value"], 1)

        # Check bar chart structure (grouped by Dependencia)
        bar_data = response.data["data"]["bar_chart"]
        self.assertEqual(len(bar_data), 2)
        # Should have data for self.dep1 (Juan) and self.dep2 (Maria)
        self.assertEqual(bar_data[0]["key"], "Dependencia de Prueba 1")
        self.assertEqual(bar_data[0]["total"], 1)
        self.assertEqual(bar_data[0]["respondidos"], 1)
        self.assertEqual(bar_data[1]["key"], "Dependencia de Prueba 2")
        self.assertEqual(bar_data[1]["total"], 1)
        self.assertEqual(bar_data[1]["respondidos"], 0)

    def test_get_report_with_dependencia_filter(self):
        """Filter by dep1 (id=10) should only return self.dep1/self.dg1 data."""
        response = self.client.get(f"{self.url}?dependencia_id=10")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Pie chart should only show Juan (1 answered)
        pie_data = response.data["data"]["pie_chart"]
        self.assertEqual(pie_data[0]["value"], 1)
        self.assertEqual(pie_data[1]["value"], 0)

        # Bar chart should be grouped by DireccionGeneral inside dep1
        bar_data = response.data["data"]["bar_chart"]
        self.assertEqual(len(bar_data), 1)
        self.assertEqual(bar_data[0]["key"], "Direccion Gen 1")
        self.assertEqual(bar_data[0]["total"], 1)
        self.assertEqual(bar_data[0]["respondidos"], 1)

    def test_get_report_with_multiple_dependencias(self):
        """Filter by multiple dependencies using bracket notation and multiple parameters."""
        response = self.client.get(f"{self.url}?dependencia_id[]=10&dependencia_id=11")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        pie_data = response.data["data"]["pie_chart"]
        self.assertEqual(pie_data[0]["value"], 1)
        self.assertEqual(pie_data[1]["value"], 1)

    def test_get_report_invalid_dependencia_id(self):
        """Passing non-existing dependency ID should raise validation error."""
        response = self.client.get(f"{self.url}?dependencia_id=99999")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertIn("no existen en la base de datos", response.data["message"])
