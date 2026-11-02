"""
Traduce un `EventoAutogestion` a las notificaciones que debe generar (B7). Puro: sin Django ni ORM.

Destinatarios de Bienestar y Carnetización se expresan por PERMISO (nunca por nombre de rol); el
trabajador se identifica por su cédula. Todos los eventos dirigidos al trabajador llevan además correo
(al correo de acceso). `clave` identifica cada ocurrencia repetible (la fecha fin
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


def _correo_bienestar(asunto: str, activo: bool) -> CorreoSolicitado | None:
    return CorreoSolicitado(asunto) if activo else None


def solicitudes_de_evento(e: EventoAutogestion, correo_a_bienestar: bool = False) -> list[SolicitudNotificacion]:
    """`correo_a_bienestar` (ajuste de infraestructura) agrega el correo a los avisos que reciben las cuentas de Bienestar."""
    d, ref = e.detalle, e.solicitud_id
    comunes = {'tipo': e.tipo.value, 'ref_tipo': REF_TIPO, 'ref_id': ref}
    al_trabajador = {**comunes, 'cedula_destino': e.cedula, 'enlace': enlace_trabajador(ref)}
    fin = d.get('ventana_fin', '')

    if e.tipo is TipoEvento.SOLICITUD_CREADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_HABILITAR, excluir_cedulas=(e.actor_cedula,), enlace=enlace_bienestar(ref),
            modulo='personal',
            titulo='Nueva solicitud de actualización de datos',
            mensaje=f'El trabajador C.I. {e.cedula} solicitó actualizar: {_secciones(d.get("secciones"))}. Para que pueda continuar, debe habilitar su ventana de actualización.',
            correo=_correo_bienestar('Nueva solicitud de actualización de datos - GATH CONATEL', correo_a_bienestar),
        )]
    if e.tipo is TipoEvento.VENTANA_HABILITADA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Actualización de datos habilitada',
            mensaje=(f'Bienestar Social habilitó la actualización de los siguientes datos: {_secciones(d.get("secciones"))}. '
                     'Para completarla, ingrese al sistema, registre la información y envíela a revisión. '
                     f'Usted dispone de plazo hasta el {_fecha(fin)}.'),
            correo=CorreoSolicitado('Actualización de datos habilitada - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.VENTANA_PRORROGADA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Plazo de actualización extendido',
            mensaje=(f'Bienestar Social extendió el plazo de su actualización de datos hasta el {_fecha(fin)}. '
                     f'Motivo: {d.get("motivo", "no indicado")}. Ingrese al sistema para completarla y enviarla antes de esa fecha.'),
            correo=CorreoSolicitado('Plazo de actualización de datos extendido - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.SOLICITUD_ENVIADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_APROBAR, excluir_cedulas=(e.actor_cedula,), enlace=enlace_bienestar(ref),
            modulo='personal',
            titulo='Solicitud de actualización lista para revisar',
            mensaje=f'El trabajador C.I. {e.cedula} envió su actualización de datos y está pendiente de su revisión. Ingrese al sistema para aprobarla, rechazarla o devolverla.',
            correo=_correo_bienestar('Actualización de datos lista para revisar - GATH CONATEL', correo_a_bienestar),
        )]
    if e.tipo is TipoEvento.SOLICITUD_DEVUELTA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=d.get('fecha', ''), titulo='Su solicitud de actualización fue devuelta',
            mensaje=(f'Bienestar Social devolvió su solicitud de actualización de datos para que la corrija. '
                     f'Motivo: {d.get("motivo", "no indicado")}. '
                     f'Ingrese al sistema, realice la corrección y reenvíela a más tardar el {_fecha(fin)}.'),
            correo=CorreoSolicitado('Solicitud de actualización de datos devuelta - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.CORRECCION_REENVIADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_APROBAR, excluir_cedulas=(e.actor_cedula,), enlace=enlace_bienestar(ref),
            modulo='personal', clave=d.get('fecha', ''),
            titulo='Corrección de actualización reenviada',
            mensaje=f'El trabajador C.I. {e.cedula} corrigió y reenvió su actualización de datos, que está pendiente de su revisión. Ingrese al sistema para revisarla.',
            correo=_correo_bienestar('Corrección de actualización de datos reenviada - GATH CONATEL', correo_a_bienestar),
        )]
    if e.tipo is TipoEvento.ACTUALIZACION_APROBADA:
        total = d.get('estado') == 'APROBADA'
        cuerpo = ('Todos los cambios propuestos fueron aprobados.' if total else
                  f'Se aprobaron {d.get("aprobados", 0)} de {d.get("total", 0)} cambios propuestos. Ingrese al sistema para consultar el detalle de los cambios no aprobados y sus motivos.')
        return [SolicitudNotificacion(
            **al_trabajador, titulo='Actualización de datos aprobada' if total else 'Actualización de datos aprobada parcialmente',
            mensaje=f'Bienestar Social revisó su solicitud de actualización de datos. {cuerpo}',
            correo=CorreoSolicitado('Actualización de datos aprobada - GATH CONATEL' if total
                                    else 'Actualización de datos aprobada parcialmente - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.SOLICITUD_RECHAZADA:
        return [SolicitudNotificacion(
            **al_trabajador, titulo='Actualización de datos rechazada',
            mensaje=(f'Bienestar Social rechazó su solicitud de actualización de datos. Motivo: {d.get("motivo", "no indicado")}. '
                     'Si lo requiere, puede presentar una nueva solicitud desde el sistema.'),
            correo=CorreoSolicitado('Actualización de datos rechazada - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.VENTANA_POR_EXPIRAR:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Su plazo de actualización está por vencer',
            mensaje=f'El plazo para actualizar sus datos vence el {_fecha(fin)}. Ingrese al sistema y envíe su solicitud antes de esa fecha.',
            correo=CorreoSolicitado('Su plazo de actualización de datos está por vencer - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.VENTANA_EXPIRADA:
        return [SolicitudNotificacion(
            **al_trabajador, clave=fin, titulo='Su plazo de actualización venció',
            mensaje='El plazo para actualizar sus datos venció sin que la solicitud fuera enviada. Si aún lo requiere, ingrese al sistema y presente una nueva solicitud.',
            correo=CorreoSolicitado('Plazo de actualización de datos vencido - GATH CONATEL'),
        )]
    if e.tipo is TipoEvento.FOTO_APROBADA:
        return [SolicitudNotificacion(
            **comunes, permiso_destino=PERMISO_CARNETIZACION, enlace='/carnetizacion/generar', modulo='carnetizacion',
            titulo='Reemisión de carnet pendiente',
            mensaje=f'El trabajador C.I. {e.cedula} actualizó su foto, por lo que su carnet debe reemitirse. Ingrese al sistema para generarlo.',
        )]
    return []
