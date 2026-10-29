"""
Publicación de eventos de autogestión como señal Django, DESPUÉS del commit.

PUNTO DE EXTENSIÓN de notificaciones (B7, Fase 3): un `@receiver(evento_autogestion)` recibirá
`evento` (`EventoAutogestion`) y creará la notificación en campana / el correo (outbox). Mientras
no haya receivers, publicar no tiene efecto. `on_commit` garantiza que nadie reaccione a datos
que luego se revierten (regla B22).
"""
import logging

from django.db import transaction
from django.dispatch import Signal

from apps.autogestion.domain.events import EventoAutogestion

logger = logging.getLogger('gath.autogestion')

evento_autogestion = Signal()


class PublicadorSenales:
    def publicar(self, evento: EventoAutogestion) -> None:
        def _enviar():
            logger.info('evento %s solicitud=%s cedula=%s', evento.tipo.value, evento.solicitud_id, evento.cedula)
            evento_autogestion.send(sender=PublicadorSenales, evento=evento)

        transaction.on_commit(_enviar)
