"""
Traduce un `EventoAutogestion` a las notificaciones que debe generar (B7). Puro: sin Django ni ORM.

Destinatarios de Bienestar y Carnetización se expresan por PERMISO (nunca por nombre de rol); el
trabajador se identifica por su cédula. Los eventos de aprobación/rechazo y de ventana
habilitada/prorrogada llevan además correo. `clave` identifica cada ocurrencia repetible (la fecha fin
de la ventana) para que reprocesar el evento no duplique avisos.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from apps.autogestion.domain.events import EventoAutogestion, TipoEvento
from core.domain.notificaciones import CorreoSolicitado, SolicitudNotificacion

ZONA = ZoneInfo('America/Caracas')
REF_TIPO = 'solicitud_actualizacion'

PERMISO_HABILITAR = 'bienestar.habilitar_ventana'   # quien recibe las solicitudes nuevas
PERMISO_APROBAR = 'bienestar.aprobar'               # quien recibe las solicitudes enviadas a revisión
PERMISO_CARNETIZACION = 'carnetizacion.emitir'      # quien reemite carnets

ETIQUETAS_SECCION = {
    'contacto': 'contacto', 'vivienda': 'vivienda', 'formacion': 'formación académica',
    'familiar': 'familiares', 'foto': 'foto', 'identidad_corregible': 'identidad', 'complementarios': 'datos complementarios',
}


def enlace_trabajador(solicitud_id: str) -> str:
    return f'/autogestion/solicitudes/{solicitud_id}'


def enlace_bienestar(solicitud_id: str) -> str:
    return f'/personal/bienestar/solicitudes/{solicitud_id}'


def _fecha(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).astimezone(ZONA).strftime('%d/%m/%Y %I:%M %p')
    except (TypeError, ValueError):
        return str(iso or '')


def _secciones(codigos) -> str:
    return ', '.join(ETIQUETAS_SECCION.get(c, c) for c in (codigos or [])) or 'sus datos'


def solicitudes_de_evento(e: EventoAutogestion) -> list[SolicitudNotificacion]:
    d, ref = e.detalle, e.solicitud_id
    comunes = {'tipo': e.tipo.value, 'ref_tipo': REF_TIPO, 'ref_id': ref}
    al_trabajador = {**comunes, 'cedula_destino': e.cedula, 'enlace': enlace_trabajador(ref)}
    fin = d.get('ventana_fin', '')

    if e.tipo is TipoEvento.SOLICITUD_CREADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_HABILITAR, excluir_cedulas=(e.actor_cedula,), enlace=enlace_bienestar(ref),
            titulo='Nueva solicitud de actualización de datos',
            mensaje=f'El trabajador C.I. {e.cedula} solicitó actualizar: {_secciones(d.get("secciones"))}. Falta habilitar la ventana.',
        )]
    if e.tipo is TipoEvento.VENTANA_HABILITADA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Actualización de datos habilitada',
            mensaje=(f'Bienestar Social habilitó la actualización de: {_secciones(d.get("secciones"))}. '
                     f'Tiene hasta el {_fecha(fin)} para completarla y enviarla.'),
            correo=CorreoSolicitado('Actualización de datos habilitada - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.VENTANA_PRORROGADA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Plazo de actualización extendido',
            mensaje=f'Bienestar Social extendió su plazo hasta el {_fecha(fin)}. Motivo: {d.get("motivo", "")}'.strip(),
            correo=CorreoSolicitado('Plazo de actualización de datos extendido - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.SOLICITUD_ENVIADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_APROBAR, excluir_cedulas=(e.actor_cedula,), enlace=enlace_bienestar(ref),
            titulo='Solicitud de actualización lista para revisar',
            mensaje=f'El trabajador C.I. {e.cedula} envió su actualización de datos para revisión.',
        )]
    if e.tipo is TipoEvento.ACTUALIZACION_APROBADA:
        total = d.get('estado') == 'APROBADA'
        cuerpo = ('Todos los cambios propuestos fueron aprobados.' if total else
                  f'Se aprobaron {d.get("aprobados", 0)} de {d.get("total", 0)} cambios; consulte el detalle de lo rechazado.')
        return [SolicitudNotificacion(
            **al_trabajador, titulo='Actualización de datos aprobada' if total else 'Actualización de datos aprobada parcialmente',
            mensaje=f'Su solicitud fue revisada. {cuerpo}',
            correo=CorreoSolicitado('Actualización de datos aprobada - GATH CONATEL' if total
                                    else 'Actualización de datos aprobada parcialmente - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.SOLICITUD_RECHAZADA:
        return [SolicitudNotificacion(
            **al_trabajador, titulo='Actualización de datos rechazada',
            mensaje=f'Su solicitud fue rechazada. Motivo: {d.get("motivo", "no indicado")}',
            correo=CorreoSolicitado('Actualización de datos rechazada - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.VENTANA_POR_EXPIRAR:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Su plazo de actualización está por vencer',
            mensaje=f'La ventana para actualizar sus datos vence el {_fecha(fin)}. Envíe su solicitud antes de esa fecha.',
        )]
    if e.tipo is TipoEvento.VENTANA_EXPIRADA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Su plazo de actualización venció',
            mensaje='La ventana de actualización de sus datos expiró sin enviarse. Puede solicitar una nueva.',
        )]
    if e.tipo is TipoEvento.FOTO_APROBADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_CARNETIZACION, enlace='/carnetizacion/generar',
            titulo='Reemisión de carnet pendiente',
            mensaje=f'El trabajador C.I. {e.cedula} actualizó su foto: su carnet debe reemitirse.',
        )]
    return []
