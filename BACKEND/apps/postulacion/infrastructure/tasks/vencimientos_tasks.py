"""
Tarea periódica (celery beat, E-7): vencimientos del flujo de postulación. Idempotente.

Libera las reservas de puesto vencidas (y devuelve a Presupuesto lo que estaba LISTO_PARA_ASIGNAR), pasa a DESISTIDO los
diferidos cuya espera venció (C-10) y a EXPIRADO los expedientes cuya ventana venció. Actúa como «sistema».
"""
import logging
from datetime import datetime, timezone

from celery import shared_task

from apps.postulacion.application.use_cases.vencimientos import procesar_vencimientos
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador

logger = logging.getLogger('gath.tasks')


@shared_task(name='postulacion.liberar_reservas_vencidas', acks_late=True)
def liberar_reservas_vencidas_tarea() -> dict:
    config = obtener_lector_configuracion()
    if config is None:
        logger.warning('postulacion.liberar_reservas_vencidas: los parámetros del sistema no están disponibles; se omite.')
        return {'omitida': True}
    r = procesar_vencimientos(RepoPostulacionORM(), config, obtener_notificador(), ahora=datetime.now(timezone.utc))
    logger.info(
        'postulacion.liberar_reservas_vencidas: %s reserva(s) vencida(s), %s vuelta(s) a Presupuesto, %s desistido(s), '
        '%s expirado(s), %s error(es)', r.reservas_vencidas, r.vueltos_a_presupuesto, r.desistidos, r.expirados, r.errores,
    )
    return {
        'reservas_vencidas': r.reservas_vencidas, 'vueltos_a_presupuesto': r.vueltos_a_presupuesto,
        'desistidos': r.desistidos, 'expirados': r.expirados, 'errores': r.errores,
    }
