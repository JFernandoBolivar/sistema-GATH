"""
Listado/reporte «Trabajadores sin fecha de ingreso» (O8).

Detecta trabajadores activos o pasivos cuyo periodo CONATEL no puede iniciarse
porque no tienen antecedente ni contrato con fecha de ingreso. RRHH lo usa para
completar el dato; sin él, el total APN queda marcado como incompleto.

Uso:
    python manage.py trabajadores_sin_fecha_ingreso --salida sin_fecha.xlsx
"""
from openpyxl import Workbook
from openpyxl.styles import Font

from django.core.management.base import BaseCommand

from apps.personal.infrastructure.models.expediente_models import ContratoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.pdf.excel_seguro import neutralizar_fila_valores


class Command(BaseCommand):
    help = 'Exporta los trabajadores sin fecha de ingreso para el cálculo APN.'

    def add_arguments(self, parser):
        parser.add_argument('--salida', default='trabajadores_sin_fecha_ingreso.xlsx', help='Ruta del archivo Excel.')

    def handle(self, *args, **options):
        empleados = (
            EmployeeModel.objects.filter(antecedentes_servicio__isnull=False)
            .distinct()
            .prefetch_related('antecedentes_servicio')
            .order_by('cedulaidentidad')
        )
        pendientes = []
        for emp in empleados:
            antecedentes = list(emp.antecedentes_servicio.all())
            tiene_ingreso = any(a.fecha_ingreso for a in antecedentes)
            if tiene_ingreso:
                continue
            tiene_contrato = ContratoModel.objects.filter(
                antecedente__empleado=emp,
                antecedente__fecha_ingreso__isnull=False,
            ).exists()
            if not tiene_contrato:
                pendientes.append(emp)

        libro = Workbook()
        hoja = libro.active
        hoja.title = 'Sin fecha de ingreso'
        hoja.append(['Cédula', 'Nombres', 'Apellidos', 'Observación'])
        for celda in hoja[1]:
            celda.font = Font(bold=True)
        for emp in pendientes:
            hoja.append(neutralizar_fila_valores([
                emp.cedulaidentidad,
                emp.nombres,
                emp.apellidos,
                'Complete la fecha de ingreso del antecedente o contrato vigente.',
            ]))
        hoja.column_dimensions['A'].width = 18
        hoja.column_dimensions['B'].width = 28
        hoja.column_dimensions['C'].width = 28
        hoja.column_dimensions['D'].width = 60
        libro.save(options['salida'])
        self.stdout.write(self.style.SUCCESS(
            f'{len(pendientes)} trabajadores sin fecha de ingreso en {options["salida"]}.'
        ))
