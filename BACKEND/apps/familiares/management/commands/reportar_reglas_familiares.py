"""FIX-FAM2: reporte de familiares existentes que incumplen las reglas del parentesco.

Uso:
    python manage.py reportar_reglas_familiares
    python manage.py reportar_reglas_familiares --json

Solo lectura. Sirve para que RRHH revise los casos históricos antes de corregir
el catálogo o los datos.
"""
import json

from django.core.management.base import BaseCommand

from apps.catalogos.infrastructure.models.catalogo_models import (
    ParentescoModel,
    SexoModel,
)
from apps.configuracion.infrastructure.models.regla_parentesco_model import (
    ReglaParentescoModel,
)
from apps.familiares.application.use_cases.validaciones_familiar import (
    ReglaParentescoFamiliar,
    regla_por_defecto,
    violaciones_reglas_familiar,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel


def _regla(parentesco) -> ReglaParentescoFamiliar:
    if parentesco is None:
        return ReglaParentescoFamiliar()
    guardada = ReglaParentescoModel.objects.filter(parentesco_id=parentesco.pk).first()
    if guardada is None:
        return regla_por_defecto(parentesco.descripcion_parentesco)
    return ReglaParentescoFamiliar(
        descripcion=parentesco.descripcion_parentesco,
        es_hijo=guardada.es_hijo,
        menor_a_cargo=guardada.menor_a_cargo,
        sin_cedula_hasta_edad=guardada.sin_cedula_hasta_edad,
        edad_minima=guardada.edad_minima,
        diferencia_minima=guardada.diferencia_minima,
        diferencia_tipo=guardada.diferencia_tipo,
        sexo_permitido=guardada.sexo_permitido,
        soporte_sugerido=guardada.soporte_sugerido,
        activo=guardada.activo,
    )


class Command(BaseCommand):
    help = 'Lista los familiares registrados que incumplen las reglas de su parentesco.'

    def add_arguments(self, parser):
        parser.add_argument('--json', action='store_true', help='Salida JSON.')

    def handle(self, *args, **options):
        reglas = {
            r.parentesco_id: r for r in ReglaParentescoModel.objects.all()
        }
        sexos = dict(SexoModel.objects.values_list('pk', 'sexo'))
        parentescos = dict(
            ParentescoModel.objects.values_list('pk', 'descripcion_parentesco')
        )
        filas = []
        for familiar in EmployeefamilyModel.objects.select_related(
            'employeecedula', 'parentesco',
        ).order_by('employeecedula_id', 'pk'):
            parentesco = familiar.parentesco
            if parentesco is None:
                continue
            regla = regla_por_defecto(parentescos.get(parentesco.pk, ''))
            guardada = reglas.get(parentesco.pk)
            if guardada is not None:
                regla = ReglaParentescoFamiliar(
                    descripcion=parentescos.get(parentesco.pk, ''),
                    es_hijo=guardada.es_hijo,
                    menor_a_cargo=guardada.menor_a_cargo,
                    sin_cedula_hasta_edad=guardada.sin_cedula_hasta_edad,
                    edad_minima=guardada.edad_minima,
                    diferencia_minima=guardada.diferencia_minima,
                    diferencia_tipo=guardada.diferencia_tipo,
                    sexo_permitido=guardada.sexo_permitido,
                    soporte_sugerido=guardada.soporte_sugerido,
                    activo=guardada.activo,
                )
            problemas = violaciones_reglas_familiar(
                regla=regla,
                fecha_nacimiento=familiar.fechanacimiento,
                fecha_nacimiento_titular=(
                    familiar.employeecedula.fecha_nacimiento
                    if familiar.employeecedula else None
                ),
                sexo=sexos.get(familiar.sexo_id),
            )
            if not problemas:
                continue
            filas.append({
                'familiar_id': familiar.pk,
                'cedula_titular': str(familiar.employeecedula_id),
                'cedula_familiar': familiar.cedulaFamiliar,
                'parentesco': parentesco.descripcion_parentesco,
                'problemas': problemas,
            })

        if options.get('json'):
            self.stdout.write(json.dumps({
                'total_revisados': EmployeefamilyModel.objects.count(),
                'total_violaciones': len(filas),
                'filas': filas,
            }, ensure_ascii=False, indent=2))
            return
        self.stdout.write(
            f'Familiares revisados: {EmployeefamilyModel.objects.count()}. '
            f'Con violaciones: {len(filas)}.'
        )
        for fila in filas:
            self.stdout.write(
                f"- familiar {fila['familiar_id']} (titular {fila['cedula_titular']}, "
                f"cédula {fila['cedula_familiar'] or 'sintética'}, "
                f"{fila['parentesco']}): " + '; '.join(fila['problemas'])
            )
