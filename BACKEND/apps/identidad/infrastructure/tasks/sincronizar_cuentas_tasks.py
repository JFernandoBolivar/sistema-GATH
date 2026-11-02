"""Tarea diaria que reconcilia las cuentas AUTOGESTION con la condición laboral."""
import logging

from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger('gath.identidad')


@shared_task(name='identidad.sincronizar_cuentas_trabajadores', acks_late=True)
def sincronizar_cuentas_trabajadores_tarea() -> str:
    """Red de seguridad: crea/reactiva/desactiva cuentas una vez al día.

    Los ingresos y egresos ya disparan el ciclo de vida en el momento; esta
    tarea cubre cargas masivas, correos agregados después y datos legados.
    """
    call_command('sincronizar_cuentas_trabajadores', aplicar=True)
    logger.info('identidad.sincronizar_cuentas_trabajadores: ejecución completada')
    return 'ok'
