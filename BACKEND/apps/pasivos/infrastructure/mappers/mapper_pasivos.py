"""
Mappers de Pasivos.
"""
from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel


def pasivo_a_entidad(modelo: EmployeeEgresadoModel, expediente: dict | None = None) -> Pasivo:
    emp = modelo.employee
    nombres = emp.nombres if emp else ""
    apellidos = emp.apellidos if emp else ""
    return Pasivo(
        id=modelo.pk,
        cedula=str(modelo.employee_id),
        nombres=nombres,
        apellidos=apellidos,
        tipo_pasivo=str(modelo.motivo_egreso) if modelo.motivo_egreso else "JUBILADO",
        fecha_egreso=str(modelo.fecha_egreso),
        resolucion=modelo.n_contrato,
        **(expediente or {}),
    )


def pasivo_desde_asignacion(asignacion, expediente: dict | None = None) -> Pasivo:
    """
    Mapea un `AsigTrabajoModel` con `Tipo_personal=PASIVO` (Fase 2.1 del
    plan de reparación) — el criterio real del legado para "es un pasivo con
    nómina activa" (`list_employees_pasive`), distinto de un registro
    `EmployeeEgresadoModel` (egreso definitivo, ver `pasivo_a_entidad`).
    """
    emp = asignacion.employee
    return Pasivo(
        id=asignacion.pk,
        cedula=str(asignacion.employee_id),
        nombres=emp.nombres if emp else "",
        apellidos=emp.apellidos if emp else "",
        tipo_pasivo=asignacion.tiponominaid.nomina if asignacion.tiponominaid else "PASIVO",
        fecha_egreso=str(asignacion.fecha_actualizacion),
        resolucion=asignacion.codigo,
        observaciones=asignacion.observaciones,
        **(expediente or {}),
    )
