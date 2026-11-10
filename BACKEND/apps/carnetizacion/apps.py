import logging

from django.apps import AppConfig

logger = logging.getLogger('gath.carnetizacion')


class CarnetizacionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.carnetizacion'
    verbose_name = 'Carnetización Institucional'

    def ready(self) -> None:
        try:
            from apps.carnetizacion.infrastructure.signals_carnet import conectar_senales_carnet
            conectar_senales_carnet()
        except Exception:
            # La app debe arrancar aunque las señales fallen; el aviso queda en el log.
            logger.warning('No se pudieron conectar las señales de carnetización.', exc_info=True)
