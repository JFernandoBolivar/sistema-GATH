"""
Ciclo de vida de la solicitud de actualización (PLAN_PRIORIDAD §2.1, B3):
solicitar -> habilitar ventana -> prorrogar -> expirar. Casos de uso puros: reciben puertos.
"""
from datetime import date, datetime, timedelta

from apps.autogestion.domain.entities.solicitud_actualizacion import ProrrogaVentana, SolicitudActualizacion
from apps.autogestion.domain.events import EventoAutogestion, PublicadorEventos, TipoEvento
from apps.autogestion.domain.ports.repo_solicitudes import RepoSecciones, RepoSolicitudes
from apps.autogestion.domain.services.politica_condicion import PoliticaAutogestion
from apps.autogestion.domain.services.validacion_motivo import validar_motivo_solicitud
from apps.autogestion.domain.value_objects.estado_solicitud import (
    ESTADOS_ABIERTOS,
    ESTADOS_EDITABLES,
    EstadoSolicitud,
)
from apps.autogestion.domain.value_objects.secciones import campos_de_secciones, secciones_de_campos, seccion_de_clave
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

MOTIVO_MAX = 500


def _texto_obligatorio(valor: str, nombre: str) -> str:
    valor = (valor or '').strip()
    if not valor:
        raise ValidationError(f"El {nombre} es obligatorio.", campo='motivo' if 'motivo' in nombre else None)
    if len(valor) > MOTIVO_MAX:
        raise ValidationError(f"El {nombre} no puede exceder {MOTIVO_MAX} caracteres.", campo='motivo' if 'motivo' in nombre else None)
    return valor


def _accion_de_clave(clave: str) -> str:
    if clave.endswith('@CREAR'):
        return 'agregar'
    if clave.endswith('@ELIMINAR'):
        return 'quitar'
    return 'corregir'


def obtener_solicitud(repo: RepoSolicitudes, solicitud_id: str, bloquear: bool = False) -> SolicitudActualizacion:
    solicitud = repo.obtener(solicitud_id, bloquear=bloquear)
    if solicitud is None:
        raise NotFoundError("La solicitud de actualización no existe.")
    return solicitud


def solicitar_actualizacion(
    repo: RepoSolicitudes, secciones_repo: RepoSecciones, publicador: PublicadorEventos,
    *, cedula: str, motivo: str, campos: list[str] | None = None, secciones: list[str] | None = None,
    politica: PoliticaAutogestion | None = None,
    bloqueo: str = 'registro',
    esperas_hasta: dict[str, date] | None = None,
    espera_acciones: frozenset[str] = frozenset({'corregir', 'quitar'}),
    excepcion_motivo: str = '',
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
    desconocidos = sorted(c for c in set(campos) if seccion_de_clave(c) is None)
    if desconocidos:
        raise ValidationError(f"Campos no autogestionables: {', '.join(desconocidos)}.")
    secciones = secciones_de_campos(campos)
    if politica is not None:
        politica.exigir_habilitado()
        politica.exigir_secciones(secciones, campo='campos')
    activas = {s.codigo for s in secciones_repo.listar(solo_activas=True)}
    inactivas = sorted(set(secciones) - activas)
    if inactivas:
        raise ValidationError(f"Secciones no autogestionables: {', '.join(inactivas)}.")
    # O48: bloqueo por solicitud pendiente (configurable) y espera tras aprobación.
    if bloqueo in ('registro', 'seccion'):
        abiertas, _ = repo.listar(None, cedula, 200, 0)
        for pendiente in abiertas:
            if pendiente.estado not in ESTADOS_ABIERTOS:
                continue
            if bloqueo == 'seccion':
                choque = sorted(set(secciones) & set(pendiente.secciones_solicitadas))
            else:
                campos_pendientes = set(pendiente.campos_solicitados) or set(
                    campos_de_secciones(pendiente.secciones_solicitadas)
                )
                choque = sorted(set(campos) & campos_pendientes)
            if choque:
                fecha = pendiente.fecha_envio or pendiente.fecha_solicitud
                cuando = fecha.strftime('%d/%m/%Y') if fecha else 'una fecha reciente'
                raise ConflictError(
                    f"Ya tienes una solicitud pendiente sobre {', '.join(choque)} "
                    f"(enviada el {cuando}). Espere su resolución o corríjala en esa solicitud.",
                    campo='campos',
                )

    esperas = esperas_hasta or {}
    if esperas:
        for seccion in secciones:
            hasta = esperas.get(seccion)
            if not hasta or date.today() > hasta:
                continue
            acciones = {
                _accion_de_clave(clave)
                for clave in campos
                if seccion_de_clave(clave) == seccion
            }
            if acciones & set(espera_acciones) and not excepcion_motivo:
                raise ConflictError(
                    f'Podrás volver a solicitar cambios en {seccion} a partir del '
                    f'{hasta.strftime("%d/%m/%Y")}.',
                    campo='campos',
                )

    nueva = SolicitudActualizacion(
        id='', cedula=cedula, estado=EstadoSolicitud.SOLICITADA, secciones_solicitadas=secciones, motivo=motivo,
        campos_solicitados=campos,
    )
    # La reserva física por sección solo se usa en el alcance «sección»; en
    # «registro»/«desactivado» la comprobación anterior es la que decide.
    creada = repo.crear(nueva, reservar=(bloqueo == 'seccion'))
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
    max_prorrogas: int = 0,
) -> SolicitudActualizacion:
    """Bienestar extiende la fecha límite (repetible hasta el máximo configurado); registro inmutable."""
    motivo = _texto_obligatorio(motivo, 'motivo de la prórroga')
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    if max_prorrogas > 0 and len(repo.listar_prorrogas(solicitud_id)) >= max_prorrogas:
        raise ConflictError(
            f'La ventana ya alcanzó el máximo de {max_prorrogas} prórrogas configurado.'
        )
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
