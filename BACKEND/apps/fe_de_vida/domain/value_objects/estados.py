"""
Estados y máquinas de transición de la fe de vida (PLAN_PRIORIDAD §2.2). Sin Django.

Proceso:    BORRADOR -> ABIERTO -> CERRADO
Solicitud:  BORRADOR -> PENDIENTE_REVISION -> PENDIENTE_SEGUNDO_CHECK -> VALIDADA -> ARCHIVADA
            PENDIENTE_SEGUNDO_CHECK -> PENDIENTE_REVISION (el revisor retira su check, con justificación)
            PENDIENTE_* -> RECHAZADA (definitivo) | DEVUELTA (devuelta para corrección); motivo obligatorio en ambas
            DEVUELTA -> PENDIENTE_REVISION (reenvío) | EXPIRADA
            BORRADOR -> EXPIRADA (el proceso cerró sin prórroga); EXPIRADA -> BORRADOR (prórroga posterior)
"""
from enum import Enum

from core.domain.exceptions import ConflictError


class EstadoProceso(str, Enum):
    BORRADOR = 'BORRADOR'
    ABIERTO = 'ABIERTO'
    CERRADO = 'CERRADO'


TRANSICIONES_PROCESO: dict[EstadoProceso, frozenset[EstadoProceso]] = {
    EstadoProceso.BORRADOR: frozenset({EstadoProceso.ABIERTO}),
    EstadoProceso.ABIERTO: frozenset({EstadoProceso.CERRADO}),
    EstadoProceso.CERRADO: frozenset(),
}


class EstadoSolicitud(str, Enum):
    BORRADOR = 'BORRADOR'
    PENDIENTE_REVISION = 'PENDIENTE_REVISION'
    PENDIENTE_SEGUNDO_CHECK = 'PENDIENTE_SEGUNDO_CHECK'
    VALIDADA = 'VALIDADA'
    RECHAZADA = 'RECHAZADA'
    DEVUELTA = 'DEVUELTA'
    EXPIRADA = 'EXPIRADA'
    ARCHIVADA = 'ARCHIVADA'


E = EstadoSolicitud
TRANSICIONES_SOLICITUD: dict[EstadoSolicitud, frozenset[EstadoSolicitud]] = {
    E.BORRADOR: frozenset({E.PENDIENTE_REVISION, E.EXPIRADA}),
    E.PENDIENTE_REVISION: frozenset({E.PENDIENTE_SEGUNDO_CHECK, E.VALIDADA, E.RECHAZADA, E.DEVUELTA}),
    E.PENDIENTE_SEGUNDO_CHECK: frozenset({E.PENDIENTE_REVISION, E.VALIDADA, E.RECHAZADA, E.DEVUELTA}),
    E.DEVUELTA: frozenset({E.PENDIENTE_REVISION, E.EXPIRADA}),
    E.VALIDADA: frozenset({E.ARCHIVADA}),
    E.RECHAZADA: frozenset(),
    E.EXPIRADA: frozenset({E.BORRADOR}),
    E.ARCHIVADA: frozenset(),
}
ESTADOS_REVISABLES = frozenset({E.PENDIENTE_REVISION, E.PENDIENTE_SEGUNDO_CHECK})
ESTADOS_EDITABLES = frozenset({E.BORRADOR, E.DEVUELTA})


class RolRevision(str, Enum):
    ANALISTA = 'ANALISTA'
    ADMINISTRADORA = 'ADMINISTRADORA'


class TipoDecision(str, Enum):
    CHECK = 'CHECK'
    CHECK_RETIRADO = 'CHECK_RETIRADO'
    APROBACION_DIRECTA = 'APROBACION_DIRECTA'
    RECHAZO = 'RECHAZO'
    DEVOLUCION = 'DEVOLUCION'


class ViaAprobacion(str, Enum):
    DOBLE_CHECK = 'DOBLE_CHECK'
    DIRECTA_ADMINISTRADORA = 'DIRECTA_ADMINISTRADORA'


class OrigenEvidencia(str, Enum):
    CAMARA = 'CAMARA'
    ARCHIVO = 'ARCHIVO'


CONDICION_PASIVO = 'PASIVO'  # condición del trabajador que hace fe de vida (la calcula el servidor)
ORIGEN_FE_DE_VIDA = 'FE_DE_VIDA'  # valor de `origen_tipo` en CambioPropuesto (compartido con autogestión)


def validar_transicion_solicitud(actual: EstadoSolicitud, nuevo: EstadoSolicitud) -> None:
    if nuevo not in TRANSICIONES_SOLICITUD[actual]:
        raise ConflictError(f"Transición no permitida: {actual.value} -> {nuevo.value}.")


def validar_transicion_proceso(actual: EstadoProceso, nuevo: EstadoProceso) -> None:
    if nuevo not in TRANSICIONES_PROCESO[actual]:
        raise ConflictError(f"El proceso está {actual.value}: no puede pasar a {nuevo.value}.")
