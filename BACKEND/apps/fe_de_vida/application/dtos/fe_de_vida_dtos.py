"""DTOs de salida de las consultas de fe de vida. Sin Django."""
from dataclasses import dataclass
from datetime import datetime

from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida


@dataclass(frozen=True)
class DetalleSolicitud:
    solicitud: SolicitudFeDeVida
    cambios: list[CambioActa]


@dataclass(frozen=True)
class CambioComparado:
    """Una respuesta del acta frente al dato real: `conflicto` si la ficha cambió desde que se propuso."""

    cambio: CambioActa
    valor_actual: object
    conflicto: bool


@dataclass(frozen=True)
class DetalleRevision:
    solicitud: SolicitudFeDeVida
    cambios: list[CambioComparado]
    nombre_pasivo: str


@dataclass(frozen=True)
class ProcesoVigente:
    proceso: ProcesoFeDeVida
    solicitud: SolicitudFeDeVida | None
    puede_enviar: bool


@dataclass(frozen=True)
class VerificacionConstancia:
    """Resultado de verificar una constancia por su código. `cedula` va completa solo en la vista interna."""

    numero: str
    emitida_en: datetime | None
    proceso_nombre: str
    nombre_completo: str
    cedula: str
    estado: str
    solicitud_id: str = ''
    certificada_por: tuple = ()
