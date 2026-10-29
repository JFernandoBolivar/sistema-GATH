"""
DTOs de la solicitud de actualización (entrada y salida de los casos de uso).
"""
from dataclasses import dataclass, field

from apps.autogestion.domain.entities.solicitud_actualizacion import (
    CambioPropuesto,
    ProrrogaVentana,
    SoporteDocumental,
    SolicitudActualizacion,
)


@dataclass(frozen=True)
class ItemCambioDTO:
    """Un cambio del borrador. En CREAR, `valor` es el dict del registro y `campo` es '*'."""
    seccion: str
    entidad: str
    accion: str
    campo: str
    valor: object
    entidad_id: str | None = None


@dataclass(frozen=True)
class DecisionCampoDTO:
    cambio_id: str
    aprobado: bool
    motivo: str = ''


@dataclass(frozen=True)
class CambioComparativoDTO:
    cambio: CambioPropuesto
    valor_actual: object = None
    conflicto: bool = False  # la ficha cambió después de proponer: no se puede aprobar tal cual


@dataclass(frozen=True)
class DetalleSolicitudDTO:
    solicitud: SolicitudActualizacion
    cambios: list[CambioComparativoDTO] = field(default_factory=list)
    soportes: list[SoporteDocumental] = field(default_factory=list)
    prorrogas: list[ProrrogaVentana] = field(default_factory=list)
