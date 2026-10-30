"""
Traduce un `EventoFeDeVida` a las notificaciones que debe generar (C6). Puro: sin Django ni ORM.

Al pasivo (bandeja del módulo `autogestion` + correo) y a Bienestar (bandeja del módulo `personal`, por
PERMISO, nunca por nombre de rol). La validada se arma aparte (`notificacion_validada`) porque lleva el
PDF de la constancia, que existe solo después del commit. `clave` identifica cada envío para que
reprocesar un evento no duplique avisos.
"""
from apps.fe_de_vida.domain.events import EventoFeDeVida, TipoEvento
from apps.fe_de_vida.domain.value_objects.estados import RolRevision
from core.domain.notificaciones import AdjuntoCorreo, CorreoSolicitado, SolicitudNotificacion

REF_TIPO = 'solicitud_fe_de_vida'
MODULO_PASIVO = 'autogestion'
MODULO_BIENESTAR = 'personal'

PERMISO_REVISAR = 'fe_de_vida.revisar'
PERMISO_CHECK_ANALISTA = 'fe_de_vida.check_analista'
PERMISO_CHECK_ADMINISTRADORA = 'fe_de_vida.check_administradora'

TIPO_RECIBIDA = 'fe_de_vida.solicitud_recibida'     # copia del aviso de envío dirigida al pasivo
TIPO_VALIDADA = TipoEvento.VALIDADA.value

ENLACE_PASIVO = '/fe-de-vida'
PLANTILLA_ENLACE_BIENESTAR = '/personal/bienestar/fe-de-vida/{id}'

ASUNTO_RECIBIDA = 'Fe de vida recibida - GATH CONATEL'
ASUNTO_DEVUELTA = 'Su fe de vida fue devuelta para corrección - GATH CONATEL'
ASUNTO_RECORDATORIO = 'Recordatorio: fe de vida pendiente - GATH CONATEL'
ASUNTO_RECHAZADA = 'Su fe de vida fue rechazada - GATH CONATEL'
ASUNTO_VALIDADA = 'Constancia de Fe de Vida {proceso} - CONATEL'

# Rol que da el primer check -> permiso de quien debe dar el segundo.
PERMISO_SEGUNDO_CHECK = {
    RolRevision.ANALISTA.value: PERMISO_CHECK_ADMINISTRADORA,
    RolRevision.ADMINISTRADORA.value: PERMISO_CHECK_ANALISTA,
}


def enlace_bienestar(solicitud_id: str) -> str:
    return PLANTILLA_ENLACE_BIENESTAR.format(id=solicitud_id)


ASUNTO_BIENESTAR = 'Fe de vida pendiente de revisión - GATH CONATEL'


def solicitudes_de_evento(e: EventoFeDeVida, correo_a_bienestar: bool = False) -> list[SolicitudNotificacion]:
    d, ref = e.detalle, e.solicitud_id
    envio = str(d.get('envio', ''))
    comunes = {'ref_tipo': REF_TIPO, 'ref_id': ref, 'clave': envio}
    al_pasivo = {**comunes, 'cedula_destino': e.cedula, 'enlace': ENLACE_PASIVO, 'modulo': MODULO_PASIVO}
    a_bienestar = {
        **comunes, 'enlace': enlace_bienestar(ref), 'modulo': MODULO_BIENESTAR, 'excluir_cedulas': (e.actor_cedula,),
        'correo': CorreoSolicitado(ASUNTO_BIENESTAR) if correo_a_bienestar else None,
    }

    if e.tipo is TipoEvento.SOLICITUD_ENVIADA:
        reenvio = int(envio or 0) > 1
        return [
            SolicitudNotificacion(
                **al_pasivo, tipo=TIPO_RECIBIDA, titulo='Su fe de vida fue recibida',
                mensaje='Bienestar Social recibió su fe de vida y la revisará. Le avisaremos el resultado.',
                correo=CorreoSolicitado(ASUNTO_RECIBIDA),
            ),
            SolicitudNotificacion(
                **a_bienestar, tipo=e.tipo.value, permiso_destino=PERMISO_REVISAR,
                titulo='Fe de vida reenviada para revisar' if reenvio else 'Nueva fe de vida para revisar',
                mensaje=(f'El pasivo C.I. {e.cedula} ' + (
                    'reenvió su fe de vida corregida.' if reenvio else 'envió su fe de vida para revisión.')),
            ),
        ]
    if e.tipo is TipoEvento.PRIMER_CHECK:
        permiso = PERMISO_SEGUNDO_CHECK.get(d.get('rol', ''))
        if permiso is None:
            return []
        return [SolicitudNotificacion(
            **a_bienestar, tipo=e.tipo.value, permiso_destino=permiso, titulo='Fe de vida pendiente de segundo check',
            mensaje=f'La fe de vida del pasivo C.I. {e.cedula} ya tiene un check y espera el suyo.',
        )]
    if e.tipo is TipoEvento.DEVUELTA:
        foto = ' Además debe tomar o subir una foto nueva con su cédula.' if d.get('requiere_nueva_foto') else ''
        return [SolicitudNotificacion(
            **al_pasivo, tipo=e.tipo.value, titulo='Su fe de vida fue devuelta para corrección',
            mensaje=(f'Bienestar Social devolvió su fe de vida para corrección. Motivo: {d.get("motivo", "no indicado")}.'
                     f'{foto} Corríjala y reenvíela.'),
            correo=CorreoSolicitado(ASUNTO_DEVUELTA),
        )]
    if e.tipo is TipoEvento.RECORDATORIO_CIERRE:
        dias = d.get('dias')
        cuando = 'mañana' if dias == 1 else f'en {dias} días'
        return [SolicitudNotificacion(
            tipo=e.tipo.value, ref_tipo='proceso_fe_de_vida', ref_id=e.proceso_id, clave=str(dias),
            cedula_destino=e.cedula, enlace=ENLACE_PASIVO, modulo=MODULO_PASIVO,
            titulo='Recuerde cumplir su fe de vida',
            mensaje=(f'El proceso "{d.get("nombre", "")}" cierra {cuando} y aún no ha enviado su fe de vida. '
                     'Ingrese al sistema para completarla.'),
            correo=CorreoSolicitado(ASUNTO_RECORDATORIO),
        )]
    if e.tipo is TipoEvento.RECHAZADA:
        return [SolicitudNotificacion(
            **al_pasivo, tipo=e.tipo.value, titulo='Su fe de vida fue rechazada',
            mensaje=f'Bienestar Social rechazó su fe de vida. Motivo: {d.get("motivo", "no indicado")}.',
            correo=CorreoSolicitado(ASUNTO_RECHAZADA),
        )]
    return []


def notificacion_validada(
    e: EventoFeDeVida, *, numero: str, proceso_nombre: str, clave_pdf: str, nombre_pdf: str,
    correos_copia: tuple[str, ...],
) -> SolicitudNotificacion:
    """Aviso de fe de vida validada con la constancia adjunta (se lee del almacén en el worker) y enlace de descarga."""
    adjuntos = (AdjuntoCorreo(nombre_pdf, clave_almacen=clave_pdf),) if clave_pdf else ()
    return SolicitudNotificacion(
        tipo=TIPO_VALIDADA, ref_tipo=REF_TIPO, ref_id=e.solicitud_id, cedula_destino=e.cedula,
        enlace=ENLACE_PASIVO, modulo=MODULO_PASIVO, titulo='Su fe de vida fue validada',
        mensaje=(f'Su fe de vida del proceso "{proceso_nombre}" fue validada. Constancia N.° {numero}: '
                 'puede descargarla desde el sistema. Este es un aviso automático.'),
        correo=CorreoSolicitado(ASUNTO_VALIDADA.format(proceso=proceso_nombre), adjuntos=adjuntos, copia_a=correos_copia),
    )
