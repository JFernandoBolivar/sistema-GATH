"""Entidades puras del postulante, el expediente y el historial. Sin Django."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class Postulante:
    """Agregado independiente: NO es Employee. `employee_cedula` guarda el vínculo con el empleado previo
    (reingreso, C-1) como texto, sin FK a las tablas heredadas."""

    id: str
    cedula: str
    nombres: str
    apellidos: str
    correo: str = ''
    telefono_movil: str = ''
    employee_cedula: str = ''
    creado_por: str = ''
    fecha_creacion: datetime | None = None

    @property
    def es_reingreso(self) -> bool:
        return bool(self.employee_cedula)


@dataclass(frozen=True)
class EmpleadoPrevio:
    """Lo mínimo que se necesita saber de un `Employee` existente con la misma cédula."""

    cedula: str
    nombres: str
    apellidos: str
    # ACTIVO / PASIVO / SIN_ASIGNACION según el resolutor central de condición.
    condicion: str = ''


@dataclass(frozen=True)
class TransicionRegistrada:
    """Asiento inmutable del historial: una fila por cambio de estado."""

    id: str
    expediente_id: str
    estado_origen: str
    estado_destino: str
    actor_cedula: str
    actor_tipo: str
    fecha: datetime
    motivo: str = ''
    datos_extra: dict = field(default_factory=dict)
