"""
Eventos de dominio de la autogestión: PUNTOS DE EXTENSIÓN para las notificaciones (B7, Fase 3).

Los casos de uso publican estos eventos por el puerto `PublicadorEventos`; el adaptador de
infraestructura emite una señal DENTRO de la transacción (de ahí la notificación y el outbox de correo
quedan atómicos con el hecho de negocio, B7) y otra tras el commit. El receiver traduce cada evento a
notificaciones por el puerto `Notificador` del kernel (domain/services/notificaciones_eventos.py).
Dos eventos llevan una acción posterior ya prevista:

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
    VENTANA_POR_EXPIRAR = 'autogestion.ventana_por_expirar'      # -> recordatorio al trabajador (beat, N horas antes)


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
