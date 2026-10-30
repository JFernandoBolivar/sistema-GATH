"""
Tarea periódica (celery beat, C17): cierra los procesos de fe de vida ABIERTOS cuya fecha de cierre ya pasó.
Las solicitudes sin enviar y sin prórroga vigente pasan a EXPIRADA. Idempotente.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.db import transaction

from apps.fe_de_vida.application.use_cases.procesos import cerrar_procesos_vencidos
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales

logger = logging.getLogger('gath.tasks')


@shared_task(name='fe_de_vida.cerrar_procesos_vencidos', acks_late=True)
def cerrar_procesos_vencidos_tarea() -> int:
    with transaction.atomic():
        cerrados = cerrar_procesos_vencidos(
            RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), ahora=datetime.now(timezone.utc),
        )
    logger.info('fe_de_vida.cerrar_procesos_vencidos: %s proceso(s) cerrado(s)', cerrados)
    return cerrados
