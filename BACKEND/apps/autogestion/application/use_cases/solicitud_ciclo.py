"""
Ciclo de vida de la solicitud de actualización (PLAN_PRIORIDAD §2.1, B3):
solicitar -> habilitar ventana -> prorrogar -> expirar. Casos de uso puros: reciben puertos.
"""
from datetime import datetime, timedelta

from apps.autogestion.domain.entities.solicitud_actualizacion import ProrrogaVentana, SolicitudActualizacion
from apps.autogestion.domain.events import EventoAutogestion, PublicadorEventos, TipoEvento
from apps.autogestion.domain.ports.repo_solicitudes import RepoSecciones, RepoSolicitudes
from apps.autogestion.domain.services.validacion_motivo import validar_motivo_solicitud
from apps.autogestion.domain.value_objects.estado_solicitud import ESTADOS_EDITABLES, EstadoSolicitud
from apps.autogestion.domain.value_objects.secciones import SECCION_DE_CAMPO, campos_de_secciones, secciones_de_campos
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

MOTIVO_MAX = 500


def _texto_obligatorio(valor: str, nombre: str) -> str:
    valor = (valor or '').strip()
    if not valor:
        raise ValidationError(f"El {nombre} es obligatorio.")
    if len(valor) > MOTIVO_MAX:
        raise ValidationError(f"El {nombre} no puede exceder {MOTIVO_MAX} caracteres.")
    return valor


def obtener_solicitud(repo: RepoSolicitudes, solicitud_id: str, bloquear: bool = False) -> SolicitudActualizacion:
    solicitud = repo.obtener(solicitud_id, bloquear=bloquear)
    if solicitud is None:
        raise NotFoundError("La solicitud de actualización no existe.")
    return solicitud


def solicitar_actualizacion(
    repo: RepoSolicitudes, secciones_repo: RepoSecciones, publicador: PublicadorEventos,
    *, cedula: str, motivo: str, campos: list[str] | None = None, secciones: list[str] | None = None,
) -> SolicitudActualizacion:
    """
    El trabajador pide actualizar CAMPOS concretos (`entidad.campo`, decisión G); queda SOLICITADA hasta que
    Bienestar habilite la ventana. `secciones` (sin `campos`) pide todos los campos de esas secciones.
    """
    if not cedula:
        raise NotFoundError("El usuario no tiene un expediente de trabajador asociado.")
    motivo = validar_motivo_solicitud(motivo)
    campos = tuple(dict.fromkeys(campos or campos_de_secciones(secciones or ())))
    if not campos:
        raise ValidationError("Debe indicar al menos un campo a actualizar.")
    desconocidos = sorted(set(campos) - set(SECCION_DE_CAMPO))
    if desconocidos:
        raise ValidationError(f"Campos no autogestionables: {', '.join(desconocidos)}.")
    secciones = secciones_de_campos(campos)
    activas = {s.codigo for s in secciones_repo.listar(solo_activas=True)}
    inactivas = sorted(set(secciones) - activas)
    if inactivas:
        raise ValidationError(f"Secciones no autogestionables: {', '.join(inactivas)}.")
    nueva = SolicitudActualizacion(
        id='', cedula=cedula, estado=EstadoSolicitud.SOLICITADA, secciones_solicitadas=secciones, motivo=motivo,
        campos_solicitados=campos,
    )
    creada = repo.crear(nueva)  # ConflictError si hay una abierta en alguna de las secciones
    publicador.publicar(EventoAutogestion(
        TipoEvento.SOLICITUD_CREADA, creada.id, cedula, cedula, {'secciones': list(secciones), 'campos': list(campos)},
    ))
    return creada


def habilitar_ventana(
    repo: RepoSolicitudes, publicador: PublicadorEventos,
    *, solicitud_id: str, plazo_dias: int, actor: str, ahora: datetime, secciones: list[str] | None = None,
) -> SolicitudActualizacion:
    """Bienestar abre la ventana con el plazo que configura (y, opcionalmente, un subconjunto de secciones)."""
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    elegidas = tuple(secciones) if secciones else solicitud.secciones_solicitadas
    habilitada = solicitud.habilitar(elegidas, plazo_dias, actor, ahora)
    guardada = repo.guardar(habilitada, solicitud.version)
    sobrantes = tuple(set(solicitud.secciones_solicitadas) - set(elegidas))
    if sobrantes:
        repo.liberar_secciones(solicitud_id, sobrantes)
    publicador.publicar(EventoAutogestion(
        TipoEvento.VENTANA_HABILITADA, solicitud_id, solicitud.cedula, actor,
        {'secciones': list(elegidas), 'ventana_fin': habilitada.ventana_fin.isoformat(), 'plazo_dias': plazo_dias},
    ))
    return guardada


def prorrogar_ventana(
    repo: RepoSolicitudes, publicador: PublicadorEventos,
    *, solicitud_id: str, nueva_fin: datetime, motivo: str, actor: str, ahora: datetime,
) -> SolicitudActualizacion:
    """Bienestar extiende la fecha límite (repetible); queda registro inmutable de cada prórroga."""
    motivo = _texto_obligatorio(motivo, 'motivo de la prórroga')
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    prorrogada = solicitud.prorrogar(nueva_fin, ahora)
    repo.agregar_prorroga(ProrrogaVentana(
        id='', solicitud_id=solicitud_id, fecha_fin_anterior=solicitud.ventana_fin,
        fecha_fin_nueva=nueva_fin, motivo=motivo, prorrogada_por=actor,
    ))
    guardada = repo.guardar(prorrogada, solicitud.version)
    publicador.publicar(EventoAutogestion(
        TipoEvento.VENTANA_PRORROGADA, solicitud_id, solicitud.cedula, actor,
        {'ventana_fin': nueva_fin.isoformat(), 'motivo': motivo},
    ))
    return guardada


def expirar_ventanas(repo: RepoSolicitudes, publicador: PublicadorEventos, ahora: datetime) -> int:
    """Tarea periódica: marca EXPIRADA las ventanas vencidas. Idempotente (revalida bajo lock)."""
    expiradas = 0
    for candidata in repo.listar_habilitadas_vencidas(ahora):
        solicitud = repo.obtener(candidata.id, bloquear=True)
        if solicitud is None or solicitud.estado not in ESTADOS_EDITABLES or solicitud.ventana_vigente(ahora):
            continue
        repo.guardar(solicitud.expirar(), solicitud.version)
        repo.liberar_secciones(solicitud.id)
        publicador.publicar(EventoAutogestion(
            TipoEvento.VENTANA_EXPIRADA, solicitud.id, solicitud.cedula, '',
            {'ventana_fin': solicitud.ventana_fin.isoformat()},
        ))
        expiradas += 1
    return expiradas


def avisar_ventanas_por_expirar(repo: RepoSolicitudes, publicador: PublicadorEventos, ahora: datetime, horas: int = 24) -> int:
    """
    Tarea periódica: recordatorio a quien tiene una ventana que vence en menos de `horas`. No cambia
    estado; es idempotente porque el receptor deduplica por (solicitud, fecha fin): una prórroga
    cambia la fecha y vuelve a armar el aviso.
    """
    avisadas = 0
    for solicitud in repo.listar_habilitadas_por_vencer(ahora, ahora + timedelta(hours=horas)):
        publicador.publicar(EventoAutogestion(
            TipoEvento.VENTANA_POR_EXPIRAR, solicitud.id, solicitud.cedula, '',
            {'ventana_fin': solicitud.ventana_fin.isoformat()},
        ))
        avisadas += 1
    return avisadas


def exigir_version(solicitud: SolicitudActualizacion, version: int | None) -> None:
    """Bloqueo optimista de extremo a extremo: la versión que vio el cliente debe ser la vigente."""
    if version is not None and version != solicitud.version:
        raise ConflictError("La solicitud cambió mientras la editaba. Recargue e intente de nuevo.")
