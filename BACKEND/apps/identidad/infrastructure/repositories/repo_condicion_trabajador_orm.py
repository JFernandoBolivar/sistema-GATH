"""
Condición del trabajador (ACTIVO/PASIVO), derivada de los datos de personal.

Mismo criterio que `apps.pasivos` (`RepoPasivosORM.obtener_por_cedula`): es PASIVO quien
tiene una asignación (`AsigTrabajo`) con `Tipo_personal = PASIVO` o un registro en
`EmployeeEgresado`; es ACTIVO quien tiene alguna otra asignación; si no, SIN_ASIGNACION.
"""
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


class RepoCondicionTrabajadorORM:
    def condicion_por_cedula(self, cedula: str) -> CondicionTrabajador:
        asignaciones = AsigTrabajoModel.objects.filter(employee_id=cedula)
        if asignaciones.filter(Tipo_personal__tipo_personal__iexact='PASIVO').exists():
            return CondicionTrabajador.PASIVO
        if EmployeeEgresadoModel.objects.filter(employee_id=cedula).exists():
            return CondicionTrabajador.PASIVO
        if asignaciones.exists():
            return CondicionTrabajador.ACTIVO
        return CondicionTrabajador.SIN_ASIGNACION
