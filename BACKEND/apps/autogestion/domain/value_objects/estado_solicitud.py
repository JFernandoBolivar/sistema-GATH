"""
Estado de la solicitud de actualización de datos (PLAN_PRIORIDAD §2.1).

    SOLICITADA -> HABILITADA | RECHAZADA
    HABILITADA -> HABILITADA (prórroga/borrador) | ENVIADA | EXPIRADA
    ENVIADA    -> APROBADA | APROBADA_PARCIAL | RECHAZADA
    EXPIRADA / APROBADA / APROBADA_PARCIAL / RECHAZADA: terminales

Una EXPIRADA se reabre solicitando de nuevo (nueva solicitud).
"""
from enum import Enum

from core.domain.exceptions import ConflictError


class EstadoSolicitud(str, Enum):
    SOLICITADA = 'SOLICITADA'
    HABILITADA = 'HABILITADA'
    ENVIADA = 'ENVIADA'
    APROBADA = 'APROBADA'
    APROBADA_PARCIAL = 'APROBADA_PARCIAL'
    RECHAZADA = 'RECHAZADA'
    EXPIRADA = 'EXPIRADA'


ESTADOS_ABIERTOS = frozenset({EstadoSolicitud.SOLICITADA, EstadoSolicitud.HABILITADA, EstadoSolicitud.ENVIADA})

TRANSICIONES: dict[EstadoSolicitud, frozenset[EstadoSolicitud]] = {
    EstadoSolicitud.SOLICITADA: frozenset({EstadoSolicitud.HABILITADA, EstadoSolicitud.RECHAZADA}),
    EstadoSolicitud.HABILITADA: frozenset({EstadoSolicitud.HABILITADA, EstadoSolicitud.ENVIADA, EstadoSolicitud.EXPIRADA}),
    EstadoSolicitud.ENVIADA: frozenset({
        EstadoSolicitud.APROBADA, EstadoSolicitud.APROBADA_PARCIAL, EstadoSolicitud.RECHAZADA,
    }),
    EstadoSolicitud.APROBADA: frozenset(),
    EstadoSolicitud.APROBADA_PARCIAL: frozenset(),
    EstadoSolicitud.RECHAZADA: frozenset(),
    EstadoSolicitud.EXPIRADA: frozenset(),
}


def validar_transicion(origen: EstadoSolicitud, destino: EstadoSolicitud) -> None:
    if destino not in TRANSICIONES[origen]:
        raise ConflictError(
            f"Transición no permitida: la solicitud está {origen.value} y no puede pasar a {destino.value}."
        )
