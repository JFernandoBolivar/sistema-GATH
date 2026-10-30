"""Consultas de fe de vida: propia del pasivo, historial por proceso, bandeja de Bienestar y evidencia."""
from dataclasses import dataclass

from apps.fe_de_vida.application.use_cases._comun import evento, obtener_proceso, obtener_solicitud, obtener_solicitud_propia
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import PublicadorEventos, PublicadorNulo, TipoEvento
from apps.fe_de_vida.domain.ports.repos import RepoCambiosActa, RepoProcesos, RepoSolicitudesFeDeVida
from core.domain.exceptions import NotFoundError
from core.domain.ports import FileStorage

EXPIRA_URL_EVIDENCIA_SEGUNDOS = 90  # URL prefirmada corta (60-120 s, §2.6)


@dataclass(frozen=True)
class DetalleSolicitud:
    solicitud: SolicitudFeDeVida
    cambios: list[CambioActa]


def obtener_mi_solicitud(
    repo_sol: RepoSolicitudesFeDeVida, repo_cambios: RepoCambiosActa, *, proceso_id: str, cedula: str,
) -> DetalleSolicitud | None:
    solicitud = repo_sol.obtener_de(proceso_id, cedula)
    return DetalleSolicitud(solicitud, repo_cambios.listar(solicitud.id)) if solicitud else None


def listar_mis_solicitudes(repo_sol: RepoSolicitudesFeDeVida, *, cedula: str) -> list[SolicitudFeDeVida]:
    """Historial del pasivo: una solicitud por proceso."""
    return repo_sol.listar_de_cedula(cedula)


def bandeja_revision(
    repo_sol: RepoSolicitudesFeDeVida, *, proceso_id: str | None = None, estado: str | None = None,
    cedula: str | None = None, limite: int = 25, desplazamiento: int = 0,
) -> tuple[list[SolicitudFeDeVida], int]:
    return repo_sol.listar(proceso_id, estado, cedula, max(1, min(limite, 100)), max(0, desplazamiento))


def detalle_para_revision(repo_sol: RepoSolicitudesFeDeVida, repo_cambios: RepoCambiosActa, *, solicitud_id: str) -> DetalleSolicitud:
    solicitud = obtener_solicitud(repo_sol, solicitud_id)
    return DetalleSolicitud(solicitud, repo_cambios.listar(solicitud.id))


def listar_procesos(repo: RepoProcesos, *, estado: str | None = None) -> list[ProcesoFeDeVida]:
    return repo.listar(estado)


def listar_prorrogas(repo: RepoProcesos, *, proceso_id: str) -> list[ProrrogaProceso]:
    obtener_proceso(repo, proceso_id)
    return repo.listar_prorrogas(proceso_id)


def url_evidencia(
    repo_sol: RepoSolicitudesFeDeVida, storage: FileStorage, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, actor_cedula: str,
) -> str:
    """URL prefirmada corta para quien tenga `fe_de_vida.ver_evidencia`; registra el acceso (auditoría)."""
    solicitud = obtener_solicitud(repo_sol, solicitud_id)
    if not solicitud.evidencia_clave:
        raise NotFoundError("La solicitud no tiene foto vigente.")
    url = storage.url_firmada(solicitud.evidencia_clave, EXPIRA_URL_EVIDENCIA_SEGUNDOS)
    (publicador or PublicadorNulo()).publicar(evento(TipoEvento.EVIDENCIA_CONSULTADA, solicitud, actor_cedula))
    return url


def mi_evidencia_existe(repo_sol: RepoSolicitudesFeDeVida, *, solicitud_id: str, cedula: str) -> bool:
    return bool(obtener_solicitud_propia(repo_sol, solicitud_id, cedula).evidencia_clave)
