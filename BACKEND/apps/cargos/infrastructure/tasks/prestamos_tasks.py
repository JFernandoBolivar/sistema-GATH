"""
Tarea periodica (celery beat, L2-06/L2-08): suspende los cargos de los
prestamos de cargo cuyo inicio llego, ajusta POR VENCER y finaliza los que ya
pasaron su ultimo dia (inicio y fin inclusivos), restaurando solo lo que cada
prestamo suspendio. Idempotente.
"""
import logging

from celery import shared_task

from apps.cargos.infrastructure.repositories.repo_prestamos_cargo_orm import RepoPrestamosCargoORM

logger = logging.getLogger('gath.tasks')


@shared_task(name='cargos.procesar_vencimientos_prestamos', acks_late=True)
def procesar_vencimientos_prestamos_tarea() -> dict:
    resumen = RepoPrestamosCargoORM().procesar_vencimientos()
    logger.info('cargos.procesar_vencimientos_prestamos: %s', resumen)
    return resumen
