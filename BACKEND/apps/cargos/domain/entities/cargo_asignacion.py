"""
Entidad de Dominio `CargoAsignacion`.
Representa un puesto de trabajo en la plantilla y su estado de ocupación.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CargoAsignacion:
    id: int
    codigo: str
    empleado_cedula: str | None
    denominacion_id: int
    denominacion_nombre: str
    especifica_id: int
    especifica_nombre: str
    tipo_nomina_id: int
    tipo_nomina_nombre: str
    estatus_id: int
    estatus_nombre: str
    dependencia_id: int | None = None
    dependencia_nombre: str | None = None
    direccion_general_id: int | None = None
    direccion_general_nombre: str | None = None
    direccion_linea_id: int | None = None
    direccion_linea_nombre: str | None = None
    coordinacion_id: int | None = None
    coordinacion_nombre: str | None = None
    observaciones: str | None = None

    @property
    def esta_vacante(self) -> bool:
        return self.empleado_cedula is None
