"""
Eventos de dominio de la autogestión: PUNTOS DE EXTENSIÓN para las notificaciones (B7, Fase 3).

Los casos de uso publican estos eventos por el puerto `PublicadorEventos`; hoy el adaptador de
infraestructura solo emite una señal Django tras el commit. En la Fase 3 un receiver creará la
notificación en campana y el correo (outbox) sin tocar los casos de uso. Dos eventos llevan una
acción posterior ya prevista:

- `ACTUALIZACION_APROBADA`: encolar el evento hacia SIGESP (outbox, sin transmitir aún).
- `FOTO_APROBADA`: alertar a Carnetización de la necesidad de reemitir el carnet.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol


class TipoEvento(str, Enum):
    SOLICITUD_CREADA = 'autogestion.solicitud_creada'            # -> avisar a Bienestar (bienestar.habilitar_ventana)
    VENTANA_HABILITADA = 'autogestion.ventana_habilitada'        # -> avisar al trabajador
    VENTANA_PRORROGADA = 'autogestion.ventana_prorrogada'        # -> avisar al trabajador
    SOLICITUD_ENVIADA = 'autogestion.solicitud_enviada'          # -> avisar a Bienestar (bienestar.aprobar)
    SOLICITUD_RECHAZADA = 'autogestion.solicitud_rechazada'      # -> avisar al trabajador
    ACTUALIZACION_APROBADA = 'autogestion.actualizacion_aprobada'  # total o parcial -> trabajador + outbox SIGESP
    FOTO_APROBADA = 'autogestion.foto_aprobada'                  # -> alerta de reemisión a Carnetización
    VENTANA_EXPIRADA = 'autogestion.ventana_expirada'            # -> avisar al trabajador


@dataclass(frozen=True)
class EventoAutogestion:
    tipo: TipoEvento
    solicitud_id: str
    cedula: str                      # trabajador dueño de la solicitud
    actor_cedula: str = ''           # quien provocó el evento (vacío si fue el sistema)
    detalle: dict = field(default_factory=dict)


class PublicadorEventos(Protocol):
    def publicar(self, evento: EventoAutogestion) -> None: ...


class PublicadorNulo:
    """Sin efectos: valor por defecto de los casos de uso y de las pruebas."""

    def publicar(self, evento: EventoAutogestion) -> None:
        return None
