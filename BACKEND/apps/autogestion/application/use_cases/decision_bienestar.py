"""
Revisión de Bienestar (B3): comparativo, decisión campo por campo (UNA sola persona) y rechazo.

La ficha del trabajador no se toca hasta `decidir_cambios`, y solo con lo aprobado, dentro de
la transacción de la petición (todo o nada).
"""
from datetime import datetime

from apps.autogestion.application.dtos.actualizacion_dtos import (
    CambioComparativoDTO,
    DecisionCampoDTO,
    DetalleSolicitudDTO,
)
from apps.autogestion.application.use_cases.solicitud_ciclo import (
    _texto_obligatorio,
    exigir_version,
    obtener_solicitud,
)
from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto, SolicitudActualizacion
from apps.autogestion.domain.events import EventoAutogestion, PublicadorEventos, TipoEvento
from apps.autogestion.domain.ports.ficha_trabajador import AplicadorCambios, LectorFicha
from apps.autogestion.domain.ports.repo_solicitudes import RepoCambiosPropuestos, RepoSoportes, RepoSolicitudes
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.domain.value_objects.secciones import (
    ORIGEN_ACTUALIZACION,
    Accion,
    DecisionCambio,
    Seccion,
)
from core.domain.exceptions import ConflictError, ValidationError


def _hay_conflicto(cambio: CambioPropuesto, actual) -> bool:
    return cambio.accion == Accion.MODIFICAR.value and actual != cambio.valor_anterior


def obtener_detalle(
    repo: RepoSolicitudes, repo_cambios: RepoCambiosPropuestos, repo_soportes: RepoSoportes, lector: LectorFicha | None,
    solicitud: SolicitudActualizacion,
) -> DetalleSolicitudDTO:
    """Solicitud + cambios (con el valor vigente de la ficha y bandera de conflicto) + soportes + prórrogas."""
    cambios = repo_cambios.listar(ORIGEN_ACTUALIZACION, solicitud.id)
    revisables = lector is not None and solicitud.estado is EstadoSolicitud.ENVIADA
    items = []
    for c in cambios:
        if c.accion == Accion.CREAR.value or not revisables:
            items.append(CambioComparativoDTO(c, valor_actual=None if c.accion == Accion.CREAR.value else c.valor_anterior))
            continue
        actual = lector.valor_actual(solicitud.cedula, c.entidad_destino, c.entidad_id, c.campo)
        items.append(CambioComparativoDTO(c, valor_actual=actual, conflicto=_hay_conflicto(c, actual)))
    return DetalleSolicitudDTO(
        solicitud=solicitud, cambios=items,
        soportes=repo_soportes.listar(ORIGEN_ACTUALIZACION, solicitud.id),
        prorrogas=repo.listar_prorrogas(solicitud.id),
    )


def obtener_comparativo(
    repo: RepoSolicitudes, repo_cambios: RepoCambiosPropuestos, repo_soportes: RepoSoportes, lector: LectorFicha,
    *, solicitud_id: str,
) -> DetalleSolicitudDTO:
    return obtener_detalle(repo, repo_cambios, repo_soportes, lector, obtener_solicitud(repo, solicitud_id))


def aplicar_cambios_aprobados(
    aplicador: AplicadorCambios, *, cedula: str, cambios: list[CambioPropuesto], soportes: list, actor: str,
) -> int:
    """Escribe solo los cambios APROBADOS. Reutilizado por la fe de vida (C19). Devuelve cuántos aplicó."""
    aprobados = [c for c in cambios if c.decision is DecisionCambio.APROBADO]
    if aprobados:
        aplicador.aplicar(cedula, aprobados, soportes, actor)
    return len(aprobados)


def decidir_cambios(
    repo: RepoSolicitudes, repo_cambios: RepoCambiosPropuestos, repo_soportes: RepoSoportes,
    lector: LectorFicha, aplicador: AplicadorCambios, publicador: PublicadorEventos,
    *, solicitud_id: str, decisiones: list[DecisionCampoDTO], version: int, actor: str,
    motivo_general: str, ahora: datetime,
) -> DetalleSolicitudDTO:
    """
    Una sola persona (bienestar.aprobar) decide TODOS los campos pendientes: todo aprobado ->
    APROBADA; mezcla -> APROBADA_PARCIAL; nada aprobado -> RECHAZADA (exige `motivo_general`).
    """
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    exigir_version(solicitud, version)
    if solicitud.estado is not EstadoSolicitud.ENVIADA:
        raise ConflictError(f"La solicitud está {solicitud.estado.value}: solo se decide una solicitud ENVIADA.")
    cambios = repo_cambios.listar(ORIGEN_ACTUALIZACION, solicitud.id)
    pendientes = {c.id: c for c in cambios if c.decision is DecisionCambio.PENDIENTE}
    por_id = {d.cambio_id: d for d in decisiones}
    if len(por_id) != len(decisiones):
        raise ValidationError("Hay decisiones repetidas para un mismo campo.")
    if set(por_id) != set(pendientes):
        raise ValidationError("Debe decidir todos los campos pendientes de la solicitud, sin omitir ni añadir otros.")

    decididos = []
    for cid, cambio in pendientes.items():
        d = por_id[cid]
        if d.aprobado and _hay_conflicto(cambio, lector.valor_actual(
            solicitud.cedula, cambio.entidad_destino, cambio.entidad_id, cambio.campo,
        )):
            raise ConflictError(
                f"El dato '{cambio.campo}' cambió en la ficha después de la propuesta: rechácelo o pida al trabajador una nueva solicitud."
            )
        decididos.append(cambio.con_decision(
            DecisionCambio.APROBADO if d.aprobado else DecisionCambio.RECHAZADO, d.motivo, actor, ahora,
        ))
    aprobados = [c for c in decididos if c.decision is DecisionCambio.APROBADO]
    destino = (
        EstadoSolicitud.APROBADA if len(aprobados) == len(decididos)
        else EstadoSolicitud.APROBADA_PARCIAL if aprobados
        else EstadoSolicitud.RECHAZADA
    )
    motivo = (motivo_general or '').strip()
    if destino is EstadoSolicitud.RECHAZADA:
        motivo = _texto_obligatorio(motivo, 'motivo del rechazo total')

    soportes = repo_soportes.listar(ORIGEN_ACTUALIZACION, solicitud.id)
    decidida = solicitud.decidir(destino, actor, motivo, ahora)  # valida estado y que no se autoapruebe
    aplicar_cambios_aprobados(aplicador, cedula=solicitud.cedula, cambios=decididos, soportes=soportes, actor=actor)
    repo_cambios.guardar_decisiones(decididos)
    guardada = repo.guardar(decidida, solicitud.version)
    repo.liberar_secciones(solicitud.id)

    secciones_aprobadas = sorted({c.seccion for c in aprobados})
    if aprobados:
        publicador.publicar(EventoAutogestion(
            TipoEvento.ACTUALIZACION_APROBADA, solicitud.id, solicitud.cedula, actor,
            {'estado': destino.value, 'secciones': secciones_aprobadas, 'aprobados': len(aprobados), 'total': len(decididos)},
        ))
        if Seccion.FOTO.value in secciones_aprobadas:
            publicador.publicar(EventoAutogestion(TipoEvento.FOTO_APROBADA, solicitud.id, solicitud.cedula, actor, {}))
    else:
        publicador.publicar(EventoAutogestion(
            TipoEvento.SOLICITUD_RECHAZADA, solicitud.id, solicitud.cedula, actor, {'motivo': motivo},
        ))
    return obtener_detalle(repo, repo_cambios, repo_soportes, None, guardada)


def rechazar_solicitud(
    repo: RepoSolicitudes, repo_cambios: RepoCambiosPropuestos, publicador: PublicadorEventos,
    *, solicitud_id: str, motivo: str, version: int | None, actor: str, ahora: datetime,
) -> SolicitudActualizacion:
    """Rechazo total con motivo: de una SOLICITADA (sin habilitar) o de una ENVIADA (sin aplicar nada)."""
    motivo = _texto_obligatorio(motivo, 'motivo del rechazo')
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=True)
    exigir_version(solicitud, version)
    rechazada = solicitud.decidir(EstadoSolicitud.RECHAZADA, actor, motivo, ahora)
    if solicitud.estado is EstadoSolicitud.ENVIADA:
        pendientes = [
            c.con_decision(DecisionCambio.RECHAZADO, motivo, actor, ahora)
            for c in repo_cambios.listar(ORIGEN_ACTUALIZACION, solicitud.id)
            if c.decision is DecisionCambio.PENDIENTE
        ]
        repo_cambios.guardar_decisiones(pendientes)
    guardada = repo.guardar(rechazada, solicitud.version)
    repo.liberar_secciones(solicitud.id)
    publicador.publicar(EventoAutogestion(
        TipoEvento.SOLICITUD_RECHAZADA, solicitud.id, solicitud.cedula, actor, {'motivo': motivo},
    ))
    return guardada

