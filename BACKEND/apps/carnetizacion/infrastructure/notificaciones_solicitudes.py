"""Avisos del ciclo de las solicitudes de carnet (campana del sistema).

Se envían al confirmar la transacción: si la operación se revierte, no sale ningún aviso.
Un fallo al notificar nunca revierte la solicitud: queda en el log.
"""
import logging
from typing import Any

from django.db import transaction

from core.domain.exceptions import DomainError
from core.domain.notificaciones import SolicitudNotificacion
from core.infrastructure.providers import obtener_notificador

logger = logging.getLogger('gath.carnetizacion')

PERMISO_BANDEJA = 'carnetizacion.emitir'
ENLACE_BANDEJA = '/carnetizacion/solicitudes'
ENLACE_MI_CARNET = '/autogestion/mi-carnet'


def _enviar(notificacion: SolicitudNotificacion) -> None:
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('Sin Notificador registrado: no se avisa %s', notificacion.tipo)
        return
    try:
        notificador.notificar(notificacion)
    except DomainError:
        logger.exception('No se pudo notificar %s', notificacion.tipo)


def notificar_solicitud_recibida(solicitud: dict[str, Any], nombre: str = '') -> None:
    quien = nombre or f"C.I. {solicitud['cedula']}"
    transaction.on_commit(lambda: _enviar(SolicitudNotificacion(
        tipo='CARNET_SOLICITUD_RECIBIDA',
        titulo='Nueva solicitud de carnet',
        mensaje=f"{quien} solicitó su carnet institucional ({solicitud.get('motivo') or 'sin motivo'}).",
        permiso_destino=PERMISO_BANDEJA,
        excluir_cedulas=(solicitud['cedula'],),
        enlace=ENLACE_BANDEJA,
        ref_tipo='SolicitudCarnet',
        ref_id=solicitud['id'],
        modulo='carnetizacion',
    )))


def notificar_solicitud_resuelta(solicitud: dict[str, Any]) -> None:
    aprobada = solicitud['estado'] == 'APROBADA'
    mensaje = (
        'Recursos Humanos aprobó su solicitud y emitió su carnet institucional. Ya puede verlo y descargarlo.'
        if aprobada else
        f"Recursos Humanos rechazó su solicitud de carnet. Motivo: {solicitud.get('motivo_rechazo') or '—'}"
    )
    transaction.on_commit(lambda: _enviar(SolicitudNotificacion(
        tipo='CARNET_SOLICITUD_APROBADA' if aprobada else 'CARNET_SOLICITUD_RECHAZADA',
        titulo='Su carnet fue emitido' if aprobada else 'Solicitud de carnet rechazada',
        mensaje=mensaje,
        cedula_destino=solicitud['cedula'],
        enlace=ENLACE_MI_CARNET,
        ref_tipo='SolicitudCarnet',
        ref_id=solicitud['id'],
        modulo='autogestion',
    )))
