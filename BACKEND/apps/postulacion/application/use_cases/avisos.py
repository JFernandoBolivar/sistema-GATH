"""
Avisos del flujo de Captación (D-9, catálogo §5.6). Sin Django.

Todo aviso se programa con `repo.al_confirmar`: sale DESPUÉS del commit y jamás si la transacción se revierte. Un
fallo al avisar no deshace la transición: queda en el log (el expediente ya cambió de estado).

Qué se emite (el postulante no recibe campana: no tiene cuenta):
  - ENVIADO_CAPTACION (postulante envía Ventana 1 o su corrección)  -> EXPEDIENTE_RECIBIDO a `postulacion.ver_bandeja`.
  - EN_REVISION_FINAL (postulante envía Ventana 2)                  -> EXPEDIENTE_REVISION_FINAL a `postulacion.ver_bandeja`.
  - EN_PRESUPUESTO (Captación abre o reabre hacia Presupuesto)       -> EXPEDIENTE_EN_PRESUPUESTO a `postulacion.ver_solicitudes`.
  - Un usuario actúa sobre ENVIADO_CAPTACION o EN_REVISION_FINAL    -> `resolver_avisos`: el aviso compartido deja de estar
    pendiente para todos los que tienen el permiso.

Correo al postulante (no tiene cuenta, por eso no usa campana): puerto `Notificador.enviar_correo_directo` (kernel), que
escribe en el outbox de `apps.notificaciones` (asíncrono, con reintentos y deduplicado por asiento). Solo si el postulante
tiene correo, y siempre tras el commit:
  - ENVIADO_CAPTACION -> EN_CORRECCION_DATOS (devolución con observaciones): «Tu postulación necesita correcciones».
  - APROBADO -> CONSOLIDANDO (reapertura de la Ventana 2): «¡Tu ingreso fue aprobado! Completa tus datos».
  - ENVIADO_CAPTACION -> RECHAZADO_CAPTACION: aviso cordial, sin el motivo interno ni más detalle.
Nunca se envía la contraseña ni la cédula: el correo solo remite al portal y recuerda que entra con la suya.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import ACTOR_POSTULANTE, ACTOR_USUARIO, EstadoExpediente
from core.domain.notificaciones import SolicitudCorreoDirecto, SolicitudNotificacion
from core.domain.ports import Notificador

logger = logging.getLogger('gath.postulacion')

E = EstadoExpediente
MODULO = 'postulacion'
REF_TIPO = 'expediente_postulacion'
PERMISO_BANDEJA = 'postulacion.ver_bandeja'
PERMISO_SOLICITUDES = 'postulacion.ver_solicitudes'
ENLACE_BANDEJA = '/captacion/expedientes/{id}'
ENLACE_SOLICITUD = '/postulacion/solicitudes/{id}'
ENLACE_PORTAL_POSTULANTE = '/postulacion/acceso'  # el enlace del correo: el envío le antepone FRONTEND_URL
ZONA_VENEZUELA = ZoneInfo('America/Caracas')

TIPO_RECIBIDO = 'EXPEDIENTE_RECIBIDO'
TIPO_REVISION_FINAL = 'EXPEDIENTE_REVISION_FINAL'
TIPO_EN_PRESUPUESTO = 'EXPEDIENTE_EN_PRESUPUESTO'
TIPO_CORREO_CORRECCION = 'POSTULACION_CORRECCION'
TIPO_CORREO_VENTANA2 = 'POSTULACION_VENTANA2'
TIPO_CORREO_RECHAZO = 'POSTULACION_RECHAZO'

# Estado que Captación atiende -> tipo de aviso compartido que esa acción cierra.
_AVISO_PENDIENTE_DE: dict[EstadoExpediente, str] = {
    E.ENVIADO_CAPTACION: TIPO_RECIBIDO,
    E.EN_REVISION_FINAL: TIPO_REVISION_FINAL,
}


def _quien(p: Postulante, exp: ExpedientePostulacion) -> str:
    return f'{p.nombres} {p.apellidos} ({exp.numero})'.strip()


def solicitudes_de_transicion(
    exp: ExpedientePostulacion, postulante: Postulante, origen: EstadoExpediente, destino: EstadoExpediente,
    actor: Actor, asiento_id: str,
) -> list[SolicitudNotificacion]:
    """Avisos de campana de este paso. `clave` = id del asiento: un reenvío tras corregir genera un aviso nuevo."""
    quien = _quien(postulante, exp)
    comunes = {'ref_tipo': REF_TIPO, 'ref_id': exp.id, 'clave': asiento_id, 'modulo': MODULO}
    if destino == E.ENVIADO_CAPTACION and actor.tipo == ACTOR_POSTULANTE:
        reingreso = ' Es un reingreso.' if postulante.es_reingreso else ''
        reenvio = origen == E.EN_CORRECCION_DATOS
        return [SolicitudNotificacion(
            tipo=TIPO_RECIBIDO, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id), **comunes,
            titulo='Expediente corregido por el postulante' if reenvio else 'Expediente recibido',
            mensaje=f'{quien} {"envió de nuevo sus datos corregidos" if reenvio else "envió su Ventana 1"}.{reingreso}',
        )]
    if destino == E.EN_REVISION_FINAL and actor.tipo == ACTOR_POSTULANTE:
        return [SolicitudNotificacion(
            tipo=TIPO_REVISION_FINAL, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id),
            titulo='Ventana 2 recibida', mensaje=f'{quien} envió su Ventana 2: pasa a revisión final.', **comunes,
        )]
    if destino == E.EN_PRESUPUESTO:
        return [SolicitudNotificacion(
            tipo=TIPO_EN_PRESUPUESTO, permiso_destino=PERMISO_SOLICITUDES, enlace=ENLACE_SOLICITUD.format(id=exp.id),
            titulo='Expediente en Presupuesto',
            mensaje=f'Captación abrió el expediente de {quien} hacia Presupuesto: revise la solicitud de personal.',
            **comunes,
        )]
    return []


def _fecha_plazo(vence: datetime | None) -> str:
    if vence is None:
        return ''
    return vence.astimezone(ZONA_VENEZUELA).strftime('%d/%m/%Y a las %H:%M (hora de Venezuela)')


def correo_al_postulante(
    exp: ExpedientePostulacion, postulante: Postulante, origen: EstadoExpediente, destino: EstadoExpediente,
    actor: Actor, asiento_id: str, motivo: str = '',
) -> SolicitudCorreoDirecto | None:
    """Correo que el postulante recibe en este paso, o None (sin correo, o paso que no lo avisa). Sin datos sensibles."""
    if not (postulante.correo or '').strip() or actor.tipo != ACTOR_USUARIO:
        return None
    base = {
        'destinatario_correo': postulante.correo, 'ref_tipo': REF_TIPO, 'ref_id': exp.id, 'clave': asiento_id,
        'enlace': ENLACE_PORTAL_POSTULANTE,
    }
    plazo = _fecha_plazo(exp.ventana_vence_el)
    if origen == E.ENVIADO_CAPTACION and destino == E.EN_CORRECCION_DATOS:
        asunto = 'Tu postulación necesita correcciones'
        cuando = (
            f'Tienes hasta el {plazo} para enviarla de nuevo: es el plazo de la ventana que reabrimos para ti.'
            if plazo else 'El plazo para enviarla de nuevo es el de la ventana que reabrimos para ti; lo verás al ingresar.'
        )
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_CORRECCION, asunto=asunto, titulo=asunto, mensaje=(
                f'Revisamos tu postulación N.º {exp.numero} y necesitamos que corrijas algunos datos para poder continuar.\n'
                f'Lo que debes corregir: {motivo.strip()}\n'
                'Ingresa al portal con tu cédula y la contraseña que creaste, corrige lo indicado y envía tu postulación otra vez.\n'
                f'{cuando}'
            ), **base,
        )
    if origen == E.APROBADO and destino == E.CONSOLIDANDO:
        asunto = '¡Tu ingreso fue aprobado! Completa tus datos'
        cuando = (
            f'Tienes hasta el {plazo} para completarlos y enviarlos.'
            if plazo else 'Completa y envía tus datos dentro del plazo que verás al ingresar al portal.'
        )
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_VENTANA2, asunto=asunto, titulo=asunto, mensaje=(
                f'¡Felicitaciones! Tu ingreso a CONATEL (postulación N.º {exp.numero}) fue aprobado.\n'
                'Para continuar con el proceso, ingresa al portal con tu cédula y la contraseña que creaste, y completa tus datos.\n'
                f'{cuando}'
            ), **base,
        )
    if origen == E.ENVIADO_CAPTACION and destino == E.RECHAZADO_CAPTACION:
        asunto = 'Sobre tu postulación a CONATEL'
        base.pop('enlace')
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_RECHAZO, asunto=asunto, titulo=asunto, mensaje=(
                f'Gracias por tu interés en formar parte de CONATEL. Revisamos tu postulación N.º {exp.numero} y, '
                'en esta oportunidad, no podemos continuar con ella.\n'
                'Te agradecemos el tiempo dedicado y te deseamos éxito en tus próximos proyectos.'
            ), **base,
        )
    return None


def programar_avisos(
    repo: RepoPostulacion, notificador: Notificador | None, *, exp: ExpedientePostulacion, postulante: Postulante,
    origen: EstadoExpediente, destino: EstadoExpediente, actor: Actor, asiento_id: str, motivo: str = '',
) -> None:
    """Llamar dentro de la transacción de la transición: los avisos salen al confirmarla."""
    if notificador is None:
        return
    solicitudes = solicitudes_de_transicion(exp, postulante, origen, destino, actor, asiento_id)
    resolver = _AVISO_PENDIENTE_DE.get(origen) if actor.tipo == ACTOR_USUARIO and actor.cedula else None
    correo = correo_al_postulante(exp, postulante, origen, destino, actor, asiento_id, motivo)
    if not solicitudes and resolver is None and correo is None:
        return

    def emitir() -> None:
        # Primero se cierra el aviso que esta acción atiende y después se emiten los nuevos (no se pisan: distinto tipo).
        if resolver is not None:
            try:
                notificador.resolver_avisos(REF_TIPO, exp.id, por_cedula=actor.cedula, tipo=resolver)
            except Exception:  # noqa: BLE001 - el aviso nunca deshace la transición
                logger.exception('No se pudo resolver el aviso %s del expediente %s', resolver, exp.numero)
        for s in solicitudes:
            try:
                notificador.notificar(s)
            except Exception:  # noqa: BLE001
                logger.exception('No se pudo notificar %s del expediente %s', s.tipo, exp.numero)
        if correo is not None:
            try:
                notificador.enviar_correo_directo(correo)
            except Exception:  # noqa: BLE001 - el correo nunca deshace la transición
                logger.exception('No se pudo encolar el correo %s del expediente %s', correo.tipo, exp.numero)

    repo.al_confirmar(emitir)
