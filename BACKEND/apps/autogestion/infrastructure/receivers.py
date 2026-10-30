"""
Receivers de los eventos de autogestión: los traducen a notificaciones por el puerto `Notificador`
del kernel (B7). Autogestión NO importa la app de notificaciones; ésta registra su implementación
en `core.infrastructure.providers` al arrancar.

Un fallo al notificar nunca debe tumbar la decisión de negocio: se aísla en un savepoint, se registra
y la operación principal continúa.
"""
import logging

from django.conf import settings
from django.db import transaction
from django.dispatch import receiver

from apps.autogestion.domain.services.notificaciones_eventos import solicitudes_de_evento
from apps.autogestion.infrastructure.signals import evento_autogestion_en_transaccion
from core.infrastructure.providers import obtener_notificador

logger = logging.getLogger('gath.autogestion')


@receiver(evento_autogestion_en_transaccion, dispatch_uid='autogestion_notificar_evento')
def notificar_evento_autogestion(sender, evento, **kwargs):
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('sin Notificador registrado: el evento %s no genera avisos', evento.tipo.value)
        return
    try:
        with transaction.atomic():
            correo_bienestar = getattr(settings, 'NOTIFICAR_BIENESTAR_POR_CORREO', False)
            for solicitud in solicitudes_de_evento(evento, correo_bienestar):
                notificador.notificar(solicitud)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudieron generar las notificaciones del evento %s', evento.tipo.value)
