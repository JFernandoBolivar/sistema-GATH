"""
Condición del trabajador (ACTIVO/PASIVO), derivada de los datos de personal.

Criterio:
- PASIVO: tiene una asignación PASIVO vigente (no EGRESADO) o, por compatibilidad
  con datos legados, solo un registro en `EmployeeEgresado` cuyo motivo es de una categoría
  pasiva (jubilación, pensión…) y ninguna asignación PASIVO. Un egreso por renuncia,
  destitución o abandono de cargo NO es un pasivo: queda SIN_ASIGNACION.
- ACTIVO: tiene una asignación no PASIVO vigente (no EGRESADO).
- SIN_ASIGNACION: no tiene asignaciones vigentes. Un pasivo con todas sus
  asignaciones PASIVO en EGRESADO entra aquí, para que el egreso desactive la cuenta.
"""
from django.db.models import Q

from core.domain.catalogos import ESTATUS_EGRESADO, MARCA_CATEGORIA_PASIVO, TIPO_PERSONAL_PASIVO
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


class RepoCondicionTrabajadorORM:
    @staticmethod
    def _egresados_pasivos_legado():
        """Registros de egresado que cuentan como pasivo legado: motivo de categoría pasiva, o
        sin motivo (datos muy antiguos, se conserva el criterio previo)."""
        return EmployeeEgresadoModel.objects.filter(
            Q(motivo_egreso__isnull=True)
            | Q(motivo_egreso__categoria__categoria__icontains=MARCA_CATEGORIA_PASIVO)
        )

    @staticmethod
    def _pasivas(asignaciones):
        return asignaciones.filter(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)

    def condicion_por_cedula(self, cedula: str) -> CondicionTrabajador:
        asignaciones = AsigTrabajoModel.objects.filter(employee_id=cedula)
        pasivas = self._pasivas(asignaciones)

        if pasivas.exclude(estatusid__estatus__iexact=ESTATUS_EGRESADO).exists():
            return CondicionTrabajador.PASIVO
        if (
            asignaciones.exclude(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
            .exclude(estatusid__estatus__iexact=ESTATUS_EGRESADO)
            .exists()
        ):
            return CondicionTrabajador.ACTIVO
        # Solo quedan asignaciones PASIVO en EGRESADO: ya no es un pasivo vigente.
        if pasivas.exists():
            return CondicionTrabajador.SIN_ASIGNACION
        # Legado: pasivo sin asignación, solo con el registro de egresado por jubilación o pensión.
        if self._egresados_pasivos_legado().filter(employee_id=cedula).exists():
            return CondicionTrabajador.PASIVO
        return CondicionTrabajador.SIN_ASIGNACION

    def cedulas_por_condicion(self, condicion: str) -> set[str]:
        """Cédulas de una condición, para filtrar el listado en pocas consultas."""
        pasivas = AsigTrabajoModel.objects.filter(
            Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
            employee_id__isnull=False,
        )
        con_pasiva = set(pasivas.values_list('employee_id', flat=True))
        pasivos_vigentes = set(
            pasivas.exclude(estatusid__estatus__iexact=ESTATUS_EGRESADO)
            .values_list('employee_id', flat=True)
        )
        activos_vigentes = set(
            AsigTrabajoModel.objects
            .exclude(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
            .exclude(estatusid__estatus__iexact=ESTATUS_EGRESADO)
            .exclude(employee_id__isnull=True)
            .values_list('employee_id', flat=True)
        ) - pasivos_vigentes
        pasivos_legado = set(
            self._egresados_pasivos_legado()
            .exclude(employee_id__in=con_pasiva)
            .values_list('employee_id', flat=True)
        ) - activos_vigentes
        pasivos = pasivos_vigentes | pasivos_legado
        if condicion == CondicionTrabajador.PASIVO.value:
            return pasivos
        return activos_vigentes - pasivos
