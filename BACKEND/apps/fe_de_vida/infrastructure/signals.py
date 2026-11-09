"""
Publicación de eventos de fe de vida como señales Django (mismo patrón que autogestión, B7/B22):
- `evento_fe_de_vida_en_transaccion`: al instante, dentro de la transacción del caso de uso (outbox atómico).
- `evento_fe_de_vida`: tras el commit, para efectos que solo deben ocurrir con datos confirmados.
"""
import logging

from django.db import transaction
from django.dispatch import Signal

from apps.fe_de_vida.domain.events import EventoFeDeVida

logger = logging.getLogger('gath.fe_de_vida')

evento_fe_de_vida_en_transaccion = Signal()
evento_fe_de_vida = Signal()


class PublicadorSenales:
    def publicar(self, evento: EventoFeDeVida) -> None:
        logger.info('evento %s solicitud=%s cedula=%s', evento.tipo.value, evento.solicitud_id, evento.cedula)
        evento_fe_de_vida_en_transaccion.send(sender=PublicadorSenales, evento=evento)

        def _enviar():
            evento_fe_de_vida.send(sender=PublicadorSenales, evento=evento)

        transaction.on_commit(_enviar)
