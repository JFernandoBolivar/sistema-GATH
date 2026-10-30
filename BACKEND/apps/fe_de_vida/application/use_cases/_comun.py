"""Auxiliares compartidos de los casos de uso de fe de vida."""
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import EventoFeDeVida, TipoEvento
from apps.fe_de_vida.domain.ports.repos import RepoProcesos, RepoSolicitudesFeDeVida
from core.domain.exceptions import NotFoundError, PermissionDeniedError


def obtener_proceso(repo: RepoProcesos, proceso_id: str, bloquear: bool = False) -> ProcesoFeDeVida:
    proceso = repo.obtener(proceso_id, bloquear=bloquear)
    if proceso is None:
        raise NotFoundError("El proceso de fe de vida no existe.")
    return proceso


def obtener_solicitud(repo: RepoSolicitudesFeDeVida, solicitud_id: str, bloquear: bool = False) -> SolicitudFeDeVida:
    solicitud = repo.obtener(solicitud_id, bloquear=bloquear)
    if solicitud is None:
        raise NotFoundError("La solicitud de fe de vida no existe.")
    return solicitud


def obtener_solicitud_propia(
    repo: RepoSolicitudesFeDeVida, solicitud_id: str, cedula: str, bloquear: bool = False,
) -> SolicitudFeDeVida:
    """Un pasivo solo opera sobre su propia solicitud (si no es suya, se responde como inexistente)."""
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=bloquear)
    if solicitud.cedula != cedula:
        raise PermissionDeniedError("La solicitud no le pertenece.")
    return solicitud


def evento(tipo: TipoEvento, solicitud: SolicitudFeDeVida, actor: str = '', **detalle) -> EventoFeDeVida:
    return EventoFeDeVida(
        tipo=tipo, proceso_id=solicitud.proceso_id, solicitud_id=solicitud.id, cedula=solicitud.cedula,
        actor_cedula=actor, detalle=detalle,
    )
