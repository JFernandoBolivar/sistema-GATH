"""
Publicación de eventos de autogestión como señales Django (B7).

Dos señales por evento:
- `evento_autogestion_en_transaccion`: se emite AL INSTANTE, dentro de la transacción del caso de uso;
  su receptor (`receivers.py`) escribe la notificación y el mensaje de correo del outbox, de modo que
  o se confirma todo junto o no queda nada (patrón outbox).
- `evento_autogestion`: se emite tras el commit (regla B22) para efectos que solo deben ocurrir con
  datos ya confirmados.
"""
import logging

from django.db import transaction
from django.dispatch import Signal

from apps.autogestion.domain.events import EventoAutogestion

logger = logging.getLogger('gath.autogestion')

evento_autogestion_en_transaccion = Signal()
evento_autogestion = Signal()


class PublicadorSenales:
    def publicar(self, evento: EventoAutogestion) -> None:
        logger.info('evento %s solicitud=%s cedula=%s', evento.tipo.value, evento.solicitud_id, evento.cedula)
        evento_autogestion_en_transaccion.send(sender=PublicadorSenales, evento=evento)

        def _enviar():
            evento_autogestion.send(sender=PublicadorSenales, evento=evento)

        transaction.on_commit(_enviar)
