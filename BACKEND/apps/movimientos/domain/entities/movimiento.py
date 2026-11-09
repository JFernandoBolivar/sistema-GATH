"""
Entidad de Dominio `MovimientoCargo` (Fase 2.5 del plan de reparación).
Réplica funcional de una fila de
`RAC/models/historial_personal_models.py::EmployeeMovementHistory`, tal
como la consume `EmployeeCargoHistorySerializer`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class MovimientoCargo:
    id: int
    empleado_cedula: str
    codigo_puesto: str
    tipo_movimiento: str
    motivo_id: int | None
    motivo_nombre: str | None
    denominacion_nombre: str
    especifica_nombre: str
    grado_nombre: str | None
    tipo_nomina_nombre: str
    estatus_nombre: str
    tipo_personal_nombre: str | None
    dependencia_nombre: str | None
    direccion_general_nombre: str | None
    direccion_linea_nombre: str | None
    coordinacion_nombre: str | None
    fecha_movimiento: str
    ejecutado_por_id: int
    ejecutado_por_nombre: str
