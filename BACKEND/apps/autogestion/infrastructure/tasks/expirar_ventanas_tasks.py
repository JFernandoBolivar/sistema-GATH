"""
Tarea periódica (celery beat): marca EXPIRADA toda ventana de actualización vencida (PLAN §2.1).

Idempotente: solo toca solicitudes HABILITADA con `ventana_fin` pasada y las revalida bajo lock.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.db import transaction

from apps.autogestion.application.use_cases.solicitud_ciclo import expirar_ventanas
from apps.autogestion.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesORM
from apps.autogestion.infrastructure.signals import PublicadorSenales

logger = logging.getLogger('gath.tasks')


@shared_task(name='autogestion.expirar_ventanas', acks_late=True)
def expirar_ventanas_vencidas() -> int:
    with transaction.atomic():
        expiradas = expirar_ventanas(RepoSolicitudesORM(), PublicadorSenales(), datetime.now(timezone.utc))
    logger.info('autogestion.expirar_ventanas: %s ventana(s) expirada(s)', expiradas)
    return expiradas
