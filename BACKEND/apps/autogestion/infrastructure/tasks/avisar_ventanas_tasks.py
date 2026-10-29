"""
Tarea periódica (celery beat): recordatorio a los trabajadores cuya ventana de actualización vence
en menos de `AUTOGESTION_AVISO_EXPIRACION_HORAS` (24 h por defecto). Idempotente: el receptor
deduplica por (solicitud, fecha fin), así que correrla cada 30 minutos no repite el aviso.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.conf import settings
from django.db import transaction

from apps.autogestion.application.use_cases.solicitud_ciclo import avisar_ventanas_por_expirar
from apps.autogestion.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesORM
from apps.autogestion.infrastructure.signals import PublicadorSenales

logger = logging.getLogger('gath.tasks')


@shared_task(name='autogestion.avisar_ventanas_por_expirar', acks_late=True)
def avisar_ventanas_por_expirar_tarea() -> int:
    with transaction.atomic():
        avisadas = avisar_ventanas_por_expirar(
            RepoSolicitudesORM(), PublicadorSenales(), datetime.now(timezone.utc),
            settings.AUTOGESTION_AVISO_EXPIRACION_HORAS,
        )
    logger.info('autogestion.avisar_ventanas_por_expirar: %s ventana(s) evaluada(s)', avisadas)
    return avisadas
