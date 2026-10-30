"""Proceso de fe de vida y sus prórrogas (PLAN_PRIORIDAD §2.2). Sin Django."""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso, validar_transicion_proceso
from core.domain.exceptions import ValidationError


@dataclass(frozen=True)
class ProcesoFeDeVida:
    id: str
    nombre: str
    fecha_apertura: datetime
    fecha_cierre: datetime
    estado: EstadoProceso = EstadoProceso.BORRADOR
    creado_por: str = ''
    abierto_por: str = ''
    cerrado_por: str = ''
    fecha_cierre_real: datetime | None = None

    def __post_init__(self):
        if not self.nombre or not self.nombre.strip():
            raise ValidationError("El proceso debe tener un nombre.")
        if self.fecha_cierre <= self.fecha_apertura:
            raise ValidationError("La fecha de cierre debe ser posterior a la de apertura.")

    def abrir(self, actor: str) -> 'ProcesoFeDeVida':
        validar_transicion_proceso(self.estado, EstadoProceso.ABIERTO)
        return replace(self, estado=EstadoProceso.ABIERTO, abierto_por=actor)

    def cerrar(self, actor: str, ahora: datetime) -> 'ProcesoFeDeVida':
        validar_transicion_proceso(self.estado, EstadoProceso.CERRADO)
        return replace(self, estado=EstadoProceso.CERRADO, cerrado_por=actor, fecha_cierre_real=ahora)

    def en_plazo(self, ahora: datetime) -> bool:
        """Abierto y dentro de su fecha de cierre (sin contar prórrogas)."""
        return self.estado is EstadoProceso.ABIERTO and ahora <= self.fecha_cierre

    def vencido(self, ahora: datetime) -> bool:
        return self.estado is EstadoProceso.ABIERTO and ahora > self.fecha_cierre


@dataclass(frozen=True)
class ProrrogaProceso:
    """`cedula` vacía = prórroga GENERAL (todos los pasivos); con cédula = individual."""

    id: str
    proceso_id: str
    nueva_fecha_limite: datetime
    motivo: str
    concedida_por: str
    cedula: str = ''
    fecha: datetime | None = None

    def __post_init__(self):
        if not self.motivo or not self.motivo.strip():
            raise ValidationError("La prórroga exige un motivo.")

    @property
    def general(self) -> bool:
        return not self.cedula

    def alcanza(self, cedula: str) -> bool:
        return self.general or self.cedula == cedula

    def vigente(self, ahora: datetime) -> bool:
        return ahora <= self.nueva_fecha_limite
