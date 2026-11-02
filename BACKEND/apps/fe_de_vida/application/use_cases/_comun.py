"""Auxiliares compartidos de los casos de uso de fe de vida."""
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import EventoFeDeVida, TipoEvento
from apps.fe_de_vida.domain.ports.repos import RepoProcesos, RepoSolicitudesFeDeVida
from core.domain.exceptions import NotFoundError, PermissionDeniedError


LIMITE_DEFECTO = 10
LIMITE_MAX = 50


def normalizar_pagina(limite: int | None, desplazamiento: int | None) -> tuple[int, int]:
    """Todo listado pagina en el servidor: 10 por defecto, tope 50."""
    return max(1, min(limite or LIMITE_DEFECTO, LIMITE_MAX)), max(0, desplazamiento or 0)


def paginar(items: list, limite: int | None, desplazamiento: int | None) -> tuple[list, int]:
    """Página de una lista corta ya ordenada (procesos, prórrogas, historial del pasivo)."""
    limite, desplazamiento = normalizar_pagina(limite, desplazamiento)
    return items[desplazamiento:desplazamiento + limite], len(items)


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
