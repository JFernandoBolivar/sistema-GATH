"""
Revisión de Bienestar (C3): doble check en orden indistinto, aprobación directa de la Administradora,
rechazo definitivo y devolución para corrección. Al quedar VALIDADA aplica el acta a los datos reales (C19). Sin Django.
"""
from datetime import datetime

from apps.fe_de_vida.application.use_cases._comun import evento, obtener_solicitud
from apps.fe_de_vida.domain.entities.solicitud import ActorRevision, SolicitudFeDeVida
from apps.fe_de_vida.domain.events import PublicadorEventos, PublicadorNulo, TipoEvento
from apps.fe_de_vida.domain.ports.repos import AplicadorCambiosActa, RepoSolicitudesFeDeVida
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud


def _al_validar(
    repo: RepoSolicitudesFeDeVida, aplicador: AplicadorCambiosActa, publicador: PublicadorEventos,
    anterior: SolicitudFeDeVida, nueva: SolicitudFeDeVida, actor: ActorRevision, ahora: datetime, tipo: TipoEvento,
) -> SolicitudFeDeVida:
    """Persiste y, si quedó VALIDADA, aplica los cambios aprobados en la misma transacción (C19)."""
    guardada = repo.guardar(nueva, anterior.version)
    if guardada.estado is EstadoSolicitud.VALIDADA:
        aplicados = aplicador.aplicar(guardada.id, guardada.cedula, actor.cedula, ahora)
        publicador.publicar(evento(
            tipo, guardada, actor.cedula, via=guardada.via_aprobacion.value, cambios_aplicados=aplicados,
        ))
        if tipo is TipoEvento.APROBACION_DIRECTA:
            publicador.publicar(evento(TipoEvento.VALIDADA, guardada, actor.cedula, via=guardada.via_aprobacion.value))
    else:
        publicador.publicar(evento(
            tipo, guardada, actor.cedula, rol=actor.rol.value, envio=guardada.envios, secuencia=len(guardada.decisiones),
        ))
    return guardada


def dar_check(
    repo: RepoSolicitudesFeDeVida, aplicador: AplicadorCambiosActa, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, actor: ActorRevision, ahora: datetime,
) -> SolicitudFeDeVida:
    """Primer check -> PENDIENTE_SEGUNDO_CHECK; segundo (otro rol y otra persona) -> VALIDADA."""
    publicador = publicador or PublicadorNulo()
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    nueva = solicitud.dar_check(actor, ahora)
    tipo = TipoEvento.VALIDADA if nueva.estado is EstadoSolicitud.VALIDADA else TipoEvento.PRIMER_CHECK
    return _al_validar(repo, aplicador, publicador, solicitud, nueva, actor, ahora, tipo)


def aprobar_directo(
    repo: RepoSolicitudesFeDeVida, aplicador: AplicadorCambiosActa, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, actor: ActorRevision, justificacion: str, ahora: datetime,
) -> SolicitudFeDeVida:
    """Excepción de la Administradora (fe_de_vida.aprobar_directo): justificación obligatoria y auditada."""
    publicador = publicador or PublicadorNulo()
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    nueva = solicitud.aprobar_directo(actor, justificacion, ahora)
    return _al_validar(repo, aplicador, publicador, solicitud, nueva, actor, ahora, TipoEvento.APROBACION_DIRECTA)


def rechazar(
    repo: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, actor: ActorRevision, motivo: str, ahora: datetime,
) -> SolicitudFeDeVida:
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    guardada = repo.guardar(solicitud.rechazar(actor, motivo, ahora), solicitud.version)
    (publicador or PublicadorNulo()).publicar(evento(TipoEvento.RECHAZADA, guardada, actor.cedula, motivo=motivo.strip(), envio=guardada.envios))
    return guardada


def devolver(
    repo: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, actor: ActorRevision, motivo: str, requiere_nueva_foto: bool = False, ahora: datetime,
) -> SolicitudFeDeVida:
    """Devuelve el acta para corrección (motivo obligatorio); la foto nueva solo se exige si el revisor lo pide."""
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    guardada = repo.guardar(solicitud.devolver(actor, motivo, ahora, requiere_nueva_foto), solicitud.version)
    (publicador or PublicadorNulo()).publicar(evento(
        TipoEvento.DEVUELTA, guardada, actor.cedula, motivo=motivo.strip(), envio=guardada.envios,
        requiere_nueva_foto=requiere_nueva_foto,
    ))
    return guardada


def retirar_check(
    repo: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, actor: ActorRevision, motivo: str, ahora: datetime,
) -> SolicitudFeDeVida:
    """Retira el check propio (aún sin validación completa); justificación obligatoria. Avisa a Bienestar (sin correo)."""
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    guardada = repo.guardar(solicitud.retirar_check(actor, motivo, ahora), solicitud.version)
    (publicador or PublicadorNulo()).publicar(evento(
        TipoEvento.CHECK_RETIRADO, guardada, actor.cedula, rol=actor.rol.value, envio=guardada.envios,
        secuencia=len(guardada.decisiones), motivo=guardada.decisiones[-1].motivo,
    ))
    return guardada
