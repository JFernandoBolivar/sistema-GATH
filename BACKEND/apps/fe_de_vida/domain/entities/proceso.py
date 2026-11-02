"""Proceso de fe de vida y sus prórrogas (PLAN_PRIORIDAD §2.2). Sin Django."""
from dataclasses import dataclass, replace
from datetime import datetime

MAX_RECORDATORIOS = 10
MAX_DIAS_RECORDATORIO = 365
MAX_TIPOS_NOMINA = 50

from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso, validar_transicion_proceso
from core.domain.exceptions import ConflictError, ValidationError


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
    tipos_nomina: tuple[int, ...] = ()        # alcance: ids de TipoNomina; vacío = todos los pasivos
    dias_recordatorio: tuple[int, ...] = ()   # días antes del cierre en que se avisa; vacío = sin recordatorios

    def __post_init__(self):
        if not self.nombre or not self.nombre.strip():
            raise ValidationError("El proceso debe tener un nombre.")
        if self.fecha_cierre <= self.fecha_apertura:
            raise ValidationError("La fecha de cierre debe ser posterior a la de apertura.")
        tipos = tuple(self.tipos_nomina)
        if any(not isinstance(t, int) or isinstance(t, bool) or t < 1 for t in tipos) or len(set(tipos)) != len(tipos):
            raise ValidationError("El alcance debe ser una lista de tipos de pensión válidos y sin repetir.")
        if len(tipos) > MAX_TIPOS_NOMINA:
            raise ValidationError("El alcance incluye demasiados tipos de pensión.")
        dias = tuple(self.dias_recordatorio)
        if any(not isinstance(d, int) or isinstance(d, bool) or not 1 <= d <= MAX_DIAS_RECORDATORIO for d in dias):
            raise ValidationError(f"Los recordatorios deben ser días enteros entre 1 y {MAX_DIAS_RECORDATORIO}.")
        if len(set(dias)) != len(dias) or len(dias) > MAX_RECORDATORIOS:
            raise ValidationError(f"Los recordatorios no pueden repetirse ni superar {MAX_RECORDATORIOS}.")
        object.__setattr__(self, 'tipos_nomina', tuple(sorted(tipos)))
        object.__setattr__(self, 'dias_recordatorio', tuple(sorted(dias, reverse=True)))

    def aplica_a(self, tipo_nomina_id: int | None) -> bool:
        """Alcance del proceso: sin tipos = todos los pasivos; con tipos, solo los de esos tipos de pensión."""
        return not self.tipos_nomina or tipo_nomina_id in self.tipos_nomina

    def editar(self, **cambios) -> 'ProcesoFeDeVida':
        """
        BORRADOR: admite nombre, fechas, alcance y recordatorios. ABIERTO: solo los recordatorios.
        CERRADO: nada. Revalida la entidad completa.
        """
        if self.estado is EstadoProceso.CERRADO:
            raise ConflictError("Un proceso cerrado no se edita.")
        if self.estado is EstadoProceso.ABIERTO and set(cambios) - {'dias_recordatorio'}:
            raise ConflictError("Un proceso abierto solo admite cambiar sus recordatorios.")
        return replace(self, **cambios)

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
