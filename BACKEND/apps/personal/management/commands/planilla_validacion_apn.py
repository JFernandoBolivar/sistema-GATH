"""
Comando RN-005-01: planilla de validación de APN para RRHH.

Exporta una muestra aleatoria y reproducible de trabajadores con antecedentes,
con cada antecedente, el tiempo CONATEL en curso, el total del sistema y dos
columnas vacías para que RRHH anote su total y observaciones.

Uso:
    python manage.py planilla_validacion_apn --muestra 50 --seed 20261104 \
        --salida planilla_apn.xlsx
"""
import random

from django.core.management.base import BaseCommand
from openpyxl import Workbook
from openpyxl.styles import Font

from apps.personal.infrastructure.models.expediente_models import ContratoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.shared.domain.services.tiempo_servicio import calcular_total_apn
from core.infrastructure.pdf.excel_seguro import neutralizar_fila_valores


def _texto(valor: dict | None) -> str:
    if not valor:
        return ''
    return f"{valor['years']}a {valor['months']}m {valor['days']}d"


class Command(BaseCommand):
    help = 'Exporta la planilla de validación de APN (RN-005-01) para RRHH.'

    def add_arguments(self, parser):
        parser.add_argument('--muestra', type=int, default=50, help='Tamaño de la muestra (por defecto 50).')
        parser.add_argument('--seed', type=int, default=20261104, help='Semilla reproducible del muestreo.')
        parser.add_argument('--salida', default='planilla_validacion_apn.xlsx', help='Ruta del archivo Excel.')

    def handle(self, *args, **options):
        from datetime import date

        trabajadores = list(
            EmployeeModel.objects.filter(antecedentes_servicio__isnull=False)
            .distinct()
            .prefetch_related('antecedentes_servicio')
            .order_by('cedulaidentidad')
        )
        if not trabajadores:
            self.stdout.write(self.style.WARNING('No hay trabajadores con antecedentes.'))
            return

        tamano = min(max(options['muestra'], 1), len(trabajadores))
        muestra = random.Random(options['seed']).sample(trabajadores, tamano)

        filas = []
        max_antecedentes = 0
        for emp in muestra:
            antecedentes = list(emp.antecedentes_servicio.all())
            max_antecedentes = max(max_antecedentes, len(antecedentes))
            contrato = (
                ContratoModel.objects.filter(antecedente__empleado=emp)
                .select_related('antecedente')
                .order_by('-pk')
                .first()
            )
            respaldo = contrato.antecedente.fecha_ingreso if contrato and contrato.antecedente else None
            apn = calcular_total_apn(
                antecedentes,
                fecha_corte=date.today(),
                fecha_ingreso_en_curso=respaldo,
            )
            filas.append({
                'cedula': emp.cedulaidentidad,
                'nombre': f'{emp.nombres} {emp.apellidos}'.strip(),
                'antecedentes': antecedentes,
                'en_curso': apn.get('en_curso'),
                'total': apn,
                'incompleto': not apn.get('completo', True),
            })

        libro = Workbook()
        hoja = libro.active
        hoja.title = 'Validación APN'

        encabezados = ['Cédula', 'Nombre']
        for i in range(1, max_antecedentes + 1):
            encabezados += [f'Antecedente {i} ingreso', f'Antecedente {i} egreso', f'Antecedente {i} organismo']
        encabezados += ['Tiempo en curso', 'Total sistema', 'Total RRHH', 'Observación']
        hoja.append(encabezados)
        for celda in hoja[1]:
            celda.font = Font(bold=True)

        for fila in filas:
            valores = [fila['cedula'], fila['nombre']]
            for ant in fila['antecedentes']:
                valores += [
                    ant.fecha_ingreso.isoformat() if ant.fecha_ingreso else '',
                    ant.fecha_egreso.isoformat() if ant.fecha_egreso else 'Presente',
                    str(ant.organismo) if getattr(ant, 'organismo', None) else '',
                ]
            valores += [''] * ((max_antecedentes - len(fila['antecedentes'])) * 3)
            valores += [
                _texto(fila['en_curso']),
                _texto(fila['total']),
                '',
                'Fecha de ingreso pendiente' if fila['incompleto'] else '',
            ]
            hoja.append(neutralizar_fila_valores(valores))

        for columna in hoja.columns:
            hoja.column_dimensions[columna[0].column_letter].width = 20

        libro.save(options['salida'])
        self.stdout.write(self.style.SUCCESS(
            f'Planilla generada con {len(filas)} trabajadores en {options["salida"]}.'
        ))
