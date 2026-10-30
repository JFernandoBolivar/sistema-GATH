"""
Publicación de eventos de identidad como señal Django (patrón de autogestión, B7).

`evento_identidad_en_transaccion` se emite al instante dentro de la transacción del caso de uso: su
receptor (`receivers.py`) escribe la notificación y el correo del outbox, de modo que o se confirma
todo junto o no queda nada.
"""
import logging

from django.dispatch import Signal

from apps.identidad.domain.events import EventoIdentidad

logger = logging.getLogger('gath.identidad')

evento_identidad_en_transaccion = Signal()


def publicar_evento_identidad(evento: EventoIdentidad) -> None:
    logger.info('evento %s cedula=%s', evento.tipo.value, evento.cedula)
    evento_identidad_en_transaccion.send(sender=publicar_evento_identidad, evento=evento)
