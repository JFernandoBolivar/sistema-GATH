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

PENDIENTE (correo al postulante): el `Notificador` solo escribe a cuentas (cédula con cuenta o permiso); el postulante
no tiene cuenta y el outbox de correo vive en `apps.notificaciones`, que esta capa no puede importar (B16). Enviar el
correo al devolver con observaciones y al reabrir la Ventana 2 exige un puerto nuevo en el kernel (correo a una
dirección arbitraria); no se fuerza aquí.
"""
import logging

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import ACTOR_POSTULANTE, ACTOR_USUARIO, EstadoExpediente
from core.domain.notificaciones import SolicitudNotificacion
from core.domain.ports import Notificador

logger = logging.getLogger('gath.postulacion')

E = EstadoExpediente
MODULO = 'postulacion'
REF_TIPO = 'expediente_postulacion'
PERMISO_BANDEJA = 'postulacion.ver_bandeja'
PERMISO_SOLICITUDES = 'postulacion.ver_solicitudes'
ENLACE_BANDEJA = '/captacion/expedientes/{id}'
ENLACE_SOLICITUD = '/postulacion/solicitudes/{id}'

TIPO_RECIBIDO = 'EXPEDIENTE_RECIBIDO'
TIPO_REVISION_FINAL = 'EXPEDIENTE_REVISION_FINAL'
TIPO_EN_PRESUPUESTO = 'EXPEDIENTE_EN_PRESUPUESTO'

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


def programar_avisos(
    repo: RepoPostulacion, notificador: Notificador | None, *, exp: ExpedientePostulacion, postulante: Postulante,
    origen: EstadoExpediente, destino: EstadoExpediente, actor: Actor, asiento_id: str,
) -> None:
    """Llamar dentro de la transacción de la transición: los avisos salen al confirmarla."""
    if notificador is None:
        return
    solicitudes = solicitudes_de_transicion(exp, postulante, origen, destino, actor, asiento_id)
    resolver = _AVISO_PENDIENTE_DE.get(origen) if actor.tipo == ACTOR_USUARIO and actor.cedula else None
    if not solicitudes and resolver is None:
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

    repo.al_confirmar(emitir)
