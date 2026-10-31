"""
Receivers de los eventos de autogestión: los traducen a notificaciones por el puerto `Notificador`
del kernel (B7). Autogestión NO importa la app de notificaciones; ésta registra su implementación
en `core.infrastructure.providers` al arrancar.

Un fallo al notificar nunca debe tumbar la decisión de negocio: se aísla en un savepoint, se registra
y la operación principal continúa.
"""
import logging

from django.db import transaction
from django.dispatch import receiver

from apps.autogestion.domain.services.notificaciones_eventos import solicitudes_de_evento
from apps.autogestion.infrastructure.signals import evento_autogestion_en_transaccion
from core.domain.configuracion import CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador

logger = logging.getLogger('gath.autogestion')


@receiver(evento_autogestion_en_transaccion, dispatch_uid='autogestion_notificar_evento')
def notificar_evento_autogestion(sender, evento, **kwargs):
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('sin Notificador registrado: el evento %s no genera avisos', evento.tipo.value)
        return
    lector = obtener_lector_configuracion()
    try:
        with transaction.atomic():
            correo_bienestar = (
                lector.obtener_booleano(CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO)
                if lector is not None else False
            )
            for solicitud in solicitudes_de_evento(evento, correo_bienestar):
                notificador.notificar(solicitud)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudieron generar las notificaciones del evento %s', evento.tipo.value)
