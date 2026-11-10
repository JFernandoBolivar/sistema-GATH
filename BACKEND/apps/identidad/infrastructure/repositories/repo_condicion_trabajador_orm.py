"""
Condición del trabajador (ACTIVO/PASIVO), derivada de los datos de personal.

Mismo criterio que `apps.pasivos` (`RepoPasivosORM.obtener_por_cedula`): es PASIVO quien
tiene una asignación (`AsigTrabajo`) con `Tipo_personal = PASIVO` o un registro en
`EmployeeEgresado`; es ACTIVO quien tiene alguna otra asignación; si no, SIN_ASIGNACION.
"""
from core.domain.catalogos import TIPO_PERSONAL_PASIVO
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


class RepoCondicionTrabajadorORM:
    def condicion_por_cedula(self, cedula: str) -> CondicionTrabajador:
        asignaciones = AsigTrabajoModel.objects.filter(employee_id=cedula)
        if asignaciones.filter(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO).exists():
            return CondicionTrabajador.PASIVO
        if EmployeeEgresadoModel.objects.filter(employee_id=cedula).exists():
            return CondicionTrabajador.PASIVO
        if asignaciones.exists():
            return CondicionTrabajador.ACTIVO
        return CondicionTrabajador.SIN_ASIGNACION

    def cedulas_por_condicion(self, condicion: str) -> set[str]:
        """Cédulas de una condición, para filtrar el listado en una sola consulta."""
        pasivos = set(
            AsigTrabajoModel.objects.filter(
                Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO
            ).values_list('employee_id', flat=True)
        ) | set(
            EmployeeEgresadoModel.objects.values_list('employee_id', flat=True)
        )
        if condicion == CondicionTrabajador.PASIVO.value:
            return pasivos
        activos = set(
            AsigTrabajoModel.objects.values_list('employee_id', flat=True)
        )
        return activos - pasivos
