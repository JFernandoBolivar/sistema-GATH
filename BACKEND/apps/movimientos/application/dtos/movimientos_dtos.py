"""
DTOs de Movimientos (Regla B5).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class MovimientoCargoDTO:
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
