"""Consultas de fe de vida: propia del pasivo, historial, bandeja de Bienestar, evidencia, constancia y cobertura."""
from datetime import datetime

from apps.fe_de_vida.application.dtos.fe_de_vida_dtos import (
    CambioComparado,
    DetalleRevision,
    DetalleSolicitud,
    ProcesoVigente,
)
from apps.fe_de_vida.application.use_cases._comun import (
    evento,
    normalizar_pagina,
    obtener_proceso,
    obtener_solicitud,
    obtener_solicitud_propia,
    paginar,
)
from apps.fe_de_vida.domain.entities.constancia import ConstanciaFeDeVida
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja, FiltroCobertura
from apps.fe_de_vida.domain.entities.pasivo import PasivoCobertura
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import PublicadorEventos, PublicadorNulo, TipoEvento
from apps.fe_de_vida.domain.ports.repos import (
    LectorPasivos,
    LectorValorActual,
    RepoCambiosActa,
    RepoCobertura,
    RepoConstancias,
    RepoProcesos,
    RepoSolicitudesFeDeVida,
)
from apps.fe_de_vida.domain.services.reglas_proceso import puede_enviar
from core.domain.exceptions import NotFoundError
from core.domain.ports import FileStorage

EXPIRA_URL_EVIDENCIA_SEGUNDOS = 90  # URL prefirmada corta (60-120 s, §2.6)


# ── Pasivo ──
def obtener_proceso_vigente(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, *, cedula: str, ahora: datetime,
) -> ProcesoVigente | None:
    """El proceso en que el pasivo puede actuar hoy: abierto y en plazo, o con prórroga vigente que lo alcance."""
    candidatos = {p.id: p for p in repo_proc.listar('ABIERTO') if p.en_plazo(ahora)}
    candidatos.update({p.id: p for p in repo_proc.listar_con_prorroga_vigente(cedula, ahora)})
    if not candidatos:
        return None
    proceso = max(candidatos.values(), key=lambda p: p.fecha_apertura)
    habilitado = puede_enviar(proceso, repo_proc.listar_prorrogas(proceso.id), cedula, ahora)
    return ProcesoVigente(proceso, repo_sol.obtener_de(proceso.id, cedula), habilitado)


def obtener_mi_solicitud(
    repo_sol: RepoSolicitudesFeDeVida, repo_cambios: RepoCambiosActa, *, solicitud_id: str, cedula: str,
) -> DetalleSolicitud:
    solicitud = obtener_solicitud_propia(repo_sol, solicitud_id, cedula)
    return DetalleSolicitud(solicitud, repo_cambios.listar(solicitud.id))


def listar_mis_solicitudes(
    repo_sol: RepoSolicitudesFeDeVida, *, cedula: str, estado: str | None = None, limite: int | None = None,
    desplazamiento: int | None = None,
) -> tuple[list[SolicitudFeDeVida], int]:
    """Historial del pasivo: una solicitud por proceso (la más reciente primero)."""
    propias = [s for s in repo_sol.listar_de_cedula(cedula) if not estado or s.estado.value == estado]
    return paginar(propias, limite, desplazamiento)


def obtener_mi_constancia(
    repo_sol: RepoSolicitudesFeDeVida, repo_const: RepoConstancias, *, solicitud_id: str, cedula: str,
) -> ConstanciaFeDeVida:
    solicitud = obtener_solicitud_propia(repo_sol, solicitud_id, cedula)
    constancia = repo_const.obtener_de_solicitud(solicitud.id)
    if constancia is None or not constancia.clave_pdf:
        raise NotFoundError("La constancia aún no está disponible.")
    return constancia


# ── Bienestar ──
def bandeja_revision(
    repo_sol: RepoSolicitudesFeDeVida, lector: LectorPasivos, *, filtro: FiltroBandeja, limite: int | None = None,
    desplazamiento: int | None = None,
) -> tuple[list[tuple[SolicitudFeDeVida, str]], int]:
    """Página de la bandeja con el nombre de cada pasivo."""
    limite, desplazamiento = normalizar_pagina(limite, desplazamiento)
    solicitudes, total = repo_sol.listar(filtro, limite, desplazamiento)
    nombres = lector.nombres_de([s.cedula for s in solicitudes])
    return [(s, nombres.get(s.cedula, s.cedula)) for s in solicitudes], total


def detalle_para_revision(
    repo_sol: RepoSolicitudesFeDeVida, repo_cambios: RepoCambiosActa, lector_valor: LectorValorActual,
    lector_pasivos: LectorPasivos, *, solicitud_id: str,
) -> DetalleRevision:
    """Solicitud con cada respuesta frente al dato real de hoy (comparativo) para decidir con criterio."""
    solicitud = obtener_solicitud(repo_sol, solicitud_id)
    cambios = []
    for c in repo_cambios.listar(solicitud.id):
        actual = lector_valor.valor_actual(solicitud.cedula, c)
        cambios.append(CambioComparado(c, actual, c.accion == 'MODIFICAR' and actual != c.valor_anterior))
    return DetalleRevision(solicitud, cambios, lector_pasivos.nombre_de(solicitud.cedula))


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


def verificar_constancia(repo_const: RepoConstancias, *, codigo: str) -> ConstanciaFeDeVida:
    constancia = repo_const.obtener_por_codigo(codigo)
    if constancia is None:
        raise NotFoundError("No existe una constancia con ese código de verificación.")
    return constancia


# ── Procesos ──
def listar_procesos(
    repo: RepoProcesos, *, estado: str | None = None, limite: int | None = None, desplazamiento: int | None = None,
) -> tuple[list[ProcesoFeDeVida], int]:
    return paginar(repo.listar(estado), limite, desplazamiento)


def listar_prorrogas(
    repo: RepoProcesos, *, proceso_id: str, limite: int | None = None, desplazamiento: int | None = None,
) -> tuple[list[ProrrogaProceso], int]:
    obtener_proceso(repo, proceso_id)
    return paginar(repo.listar_prorrogas(proceso_id), limite, desplazamiento)


# ── Cobertura (C16) ──
def listar_cobertura(
    repo: RepoCobertura, *, filtro: FiltroCobertura, limite: int | None = None, desplazamiento: int | None = None,
) -> tuple[list[PasivoCobertura], int]:
    limite, desplazamiento = normalizar_pagina(limite, desplazamiento)
    return repo.listar(filtro, limite, desplazamiento)
