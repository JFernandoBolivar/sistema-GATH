"""Estadísticas de fe de vida para Bienestar Social (O21). Sin Django.

El universo son los pasivos obligados del proceso (su asignación laboral PASIVO,
acotada por el alcance de tipos de nómina del proceso). «Respondieron» significa
que enviaron la solicitud (fecha de envío); «faltan» son los demás, incluidos
los que solo tienen borrador.
"""
from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass(frozen=True)
class FiltroEstadisticas:
    proceso_id: str | None = None
    tipo_nomina_id: int | None = None
    estado: str | None = None
    canal: str | None = None
    desde: date | None = None
    hasta: date | None = None


@dataclass(frozen=True)
class ProcesoResumen:
    id: str
    nombre: str
    estado: str
    apertura: datetime | None
    cierre: datetime | None


@dataclass(frozen=True)
class FilaTipo:
    tipo_nomina_id: int | None
    tipo_nomina: str
    total: int
    respondieron: int
    faltan: int
    validadas: int


@dataclass(frozen=True)
class FilaEstado:
    estado: str
    total: int


@dataclass(frozen=True)
class FilaCanal:
    canal: str
    total: int


@dataclass(frozen=True)
class FilaMatriz:
    tipo_nomina_id: int | None
    tipo_nomina: str
    estado: str
    total: int


@dataclass(frozen=True)
class ConteosEstadistica:
    total: int = 0
    respondieron: int = 0
    faltan: int = 0
    validadas: int = 0
    por_tipo: tuple[FilaTipo, ...] = ()
    por_estado: tuple[FilaEstado, ...] = ()
    por_canal: tuple[FilaCanal, ...] = ()
    matriz: tuple[FilaMatriz, ...] = ()


@dataclass(frozen=True)
class EstadisticasFeDeVida:
    proceso: ProcesoResumen | None
    procesos: tuple[ProcesoResumen, ...] = ()
    tipos: tuple = ()            # tuple[TipoPension] (evita importar la entidad aquí)
    conteos: ConteosEstadistica = field(default_factory=ConteosEstadistica)
    filtro: FiltroEstadisticas = field(default_factory=FiltroEstadisticas)

    @property
    def porcentaje_respondieron(self) -> float:
        return _porcentaje(self.conteos.respondieron, self.conteos.total)

    @property
    def porcentaje_faltan(self) -> float:
        return _porcentaje(self.conteos.faltan, self.conteos.total)

    @property
    def porcentaje_validadas(self) -> float:
        return _porcentaje(self.conteos.validadas, self.conteos.total)


@dataclass(frozen=True)
class PasivoEstadistica:
    cedula: str
    nombre_completo: str
    tipo_nomina: str
    correo: str
    telefono: str
    estado: str = ''
    canal: str = ''
    fecha_envio: datetime | None = None


def _porcentaje(parte: int, total: int) -> float:
    if not total:
        return 0.0
    return round(parte * 100 / total, 2)
