"""
Gestión de procesos y prórrogas por Bienestar (C17): crear, abrir, cerrar (a mano o por beat) y prorrogar
de forma individual (cédula) o general. Sin Django.
"""
from datetime import datetime

from apps.fe_de_vida.application.use_cases._comun import evento, obtener_proceso
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.events import EventoFeDeVida, PublicadorEventos, PublicadorNulo, TipoEvento
from apps.fe_de_vida.domain.ports.repos import LectorAlcance, RepoProcesos, RepoSolicitudesFeDeVida
from apps.fe_de_vida.domain.services.reglas_proceso import prorroga_vigente
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso, EstadoSolicitud
from core.domain.exceptions import ConflictError, ValidationError

SISTEMA = ''  # actor vacío = cierre automático por beat


def _exigir_tipos_validos(alcance: LectorAlcance | None, tipos_nomina) -> None:
    """El alcance solo admite tipos de pensión que existen entre los pasivos (catálogo por consulta)."""
    if not tipos_nomina:
        return
    if alcance is None:
        raise ValidationError("No se pudo validar el alcance del proceso.")
    validos = {t.id for t in alcance.tipos_pension()}
    desconocidos = sorted(set(tipos_nomina) - validos)
    if desconocidos:
        raise ValidationError(f"Tipo(s) de pensión no válido(s) para el alcance: {desconocidos}.")


def crear_proceso(
    repo: RepoProcesos, alcance: LectorAlcance | None = None, *, nombre: str, fecha_apertura: datetime,
    fecha_cierre: datetime, actor: str, tipos_nomina: tuple[int, ...] = (), dias_recordatorio: tuple[int, ...] = (),
) -> ProcesoFeDeVida:
    """`tipos_nomina` vacío = el proceso aplica a todos los pasivos; `dias_recordatorio` vacío = sin recordatorios."""
    proceso = ProcesoFeDeVida(
        id='', nombre=nombre.strip() if nombre else nombre, fecha_apertura=fecha_apertura,
        fecha_cierre=fecha_cierre, creado_por=actor, tipos_nomina=tuple(tipos_nomina),
        dias_recordatorio=tuple(dias_recordatorio),
    )
    _exigir_tipos_validos(alcance, proceso.tipos_nomina)
    return repo.crear(proceso)


def editar_proceso(
    repo: RepoProcesos, alcance: LectorAlcance | None = None, *, proceso_id: str, cambios: dict,
) -> ProcesoFeDeVida:
    """
    Edita nombre, fechas, alcance (`tipos_nomina`) y recordatorios mientras el proceso es BORRADOR; abierto,
    solo los recordatorios. `cambios` trae únicamente los campos a modificar.
    """
    permitidos = {'nombre', 'fecha_apertura', 'fecha_cierre', 'tipos_nomina', 'dias_recordatorio'}
    if not cambios or set(cambios) - permitidos:
        raise ValidationError("Indique al menos un campo editable del proceso.")
    cambios = dict(cambios)
    if cambios.get('nombre'):
        cambios['nombre'] = cambios['nombre'].strip()
    for campo in ('tipos_nomina', 'dias_recordatorio'):
        if campo in cambios:
            cambios[campo] = tuple(cambios[campo])
    proceso = obtener_proceso(repo, proceso_id, bloquear=True).editar(**cambios)
    _exigir_tipos_validos(alcance, proceso.tipos_nomina if 'tipos_nomina' in cambios else ())
    return repo.guardar(proceso)


def abrir_proceso(
    repo: RepoProcesos, publicador: PublicadorEventos | None = None, *, proceso_id: str, actor: str,
) -> ProcesoFeDeVida:
    proceso = repo.guardar(obtener_proceso(repo, proceso_id, bloquear=True).abrir(actor))
    (publicador or PublicadorNulo()).publicar(
        EventoFeDeVida(TipoEvento.PROCESO_ABIERTO, proceso.id, actor_cedula=actor, detalle={'nombre': proceso.nombre}),
    )
    return proceso


def cerrar_proceso(
    repo: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, proceso_id: str, actor: str, ahora: datetime,
) -> tuple[ProcesoFeDeVida, int]:
    """
    Cierra el proceso. Las solicitudes en BORRADOR o DEVUELTA que no tengan una prórroga
    vigente pasan a EXPIRADA (sin sanción automática); las ya enviadas siguen su revisión normal.
    Devuelve (proceso, cuántas expiraron).
    """
    publicador = publicador or PublicadorNulo()
    proceso = repo.guardar(obtener_proceso(repo, proceso_id, bloquear=True).cerrar(actor, ahora))
    prorrogas = repo.listar_prorrogas(proceso.id)
    abiertas = repo_sol.listar_de_proceso(
        proceso.id, (EstadoSolicitud.BORRADOR.value, EstadoSolicitud.DEVUELTA.value),
    )
    expiradas = 0
    for s in abiertas:
        if prorroga_vigente(prorrogas, s.cedula, ahora) is None:
            s = repo_sol.guardar(s.expirar(), s.version)
            publicador.publicar(evento(TipoEvento.EXPIRADA, s, actor))
            expiradas += 1
    publicador.publicar(EventoFeDeVida(
        TipoEvento.PROCESO_CERRADO, proceso.id, actor_cedula=actor, detalle={'expiradas': expiradas},
    ))
    return proceso, expiradas


def cerrar_procesos_vencidos(
    repo: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, ahora: datetime,
) -> int:
    """Tarea periódica (beat): cierra los procesos ABIERTOS cuya fecha de cierre ya pasó."""
    cerrados = 0
    for p in repo.listar_abiertos_vencidos(ahora):
        cerrar_proceso(repo, repo_sol, publicador, proceso_id=p.id, actor=SISTEMA, ahora=ahora)
        cerrados += 1
    return cerrados


def prorrogar_proceso(
    repo: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, proceso_id: str, cedula: str | None, nueva_fecha_limite: datetime, motivo: str, actor: str, ahora: datetime,
) -> ProrrogaProceso:
    """
    `cedula` con valor = prórroga INDIVIDUAL; vacía/None = GENERAL (todos). Un proceso en BORRADOR no se
    prorroga. Las solicitudes EXPIRADAS alcanzadas por la prórroga vuelven a BORRADOR.
    """
    publicador = publicador or PublicadorNulo()
    proceso = obtener_proceso(repo, proceso_id, bloquear=True)
    if proceso.estado is EstadoProceso.BORRADOR:
        raise ConflictError("Un proceso en BORRADOR no se prorroga: ábralo primero.")
    if nueva_fecha_limite <= ahora:
        raise ValidationError("La nueva fecha límite debe ser posterior a la fecha actual.")
    prorroga = repo.agregar_prorroga(ProrrogaProceso(
        id='', proceso_id=proceso.id, nueva_fecha_limite=nueva_fecha_limite, motivo=motivo,
        concedida_por=actor, cedula=(cedula or '').strip(), fecha=ahora,
    ))
    if proceso.estado is EstadoProceso.CERRADO:
        for s in repo_sol.listar_de_proceso(proceso.id, (EstadoSolicitud.EXPIRADA.value,)):
            if prorroga.alcanza(s.cedula):
                repo_sol.guardar(s.rehabilitar(), s.version)
    publicador.publicar(EventoFeDeVida(
        TipoEvento.PRORROGA_CONCEDIDA, proceso.id, cedula=prorroga.cedula, actor_cedula=actor,
        detalle={'general': prorroga.general, 'hasta': nueva_fecha_limite.isoformat(), 'motivo': prorroga.motivo},
    ))
    return prorroga


ESTADOS_SIN_ENVIAR = frozenset({EstadoSolicitud.BORRADOR, EstadoSolicitud.DEVUELTA, EstadoSolicitud.EXPIRADA})


def enviar_recordatorios(
    repo: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, alcance: LectorAlcance,
    publicador: PublicadorEventos | None = None, *, ahora: datetime,
) -> int:
    """
    C8 (beat diario): en cada proceso ABIERTO y en plazo, si faltan exactamente N días para el cierre y N está
    en `dias_recordatorio`, avisa a los pasivos del alcance que no tienen solicitud enviada. `ahora` debe venir
    en la zona horaria local. Idempotente: el aviso lleva (proceso, N) y el notificador no repite por
    destinatario. Devuelve cuántos avisos solicitó.
    """
    publicador = publicador or PublicadorNulo()
    avisos = 0
    for proceso in repo.listar(EstadoProceso.ABIERTO.value):
        if not proceso.en_plazo(ahora) or not proceso.dias_recordatorio:
            continue
        faltan = (proceso.fecha_cierre.astimezone(ahora.tzinfo).date() - ahora.date()).days
        if faltan not in proceso.dias_recordatorio:
            continue
        enviadas = {
            s.cedula for s in repo_sol.listar_de_proceso(proceso.id) if s.estado not in ESTADOS_SIN_ENVIAR
        }
        for cedula in alcance.cedulas_en_alcance(proceso.tipos_nomina):
            if cedula in enviadas:
                continue
            publicador.publicar(EventoFeDeVida(
                TipoEvento.RECORDATORIO_CIERRE, proceso.id, cedula=cedula,
                detalle={'dias': faltan, 'cierre': proceso.fecha_cierre.isoformat(), 'nombre': proceso.nombre},
            ))
            avisos += 1
    return avisos
