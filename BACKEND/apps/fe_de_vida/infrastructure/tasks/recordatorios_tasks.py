"""
Tarea periódica (celery beat, C8): avisa (sistema + correo) a los pasivos del alcance que aún no enviaron su
fe de vida cuando faltan N días para el cierre del proceso (N según `dias_recordatorio` de cada proceso).
Corre una vez al día; idempotente: el notificador no repite el aviso (proceso, N) a la misma persona.
"""
import logging

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.fe_de_vida.application.use_cases.procesos import enviar_recordatorios
from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales

logger = logging.getLogger('gath.tasks')


@shared_task(name='fe_de_vida.enviar_recordatorios', acks_late=True)
def enviar_recordatorios_tarea() -> int:
    with transaction.atomic():
        avisos = enviar_recordatorios(
            RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), LectorAlcanceORM(), PublicadorSenales(),
            ahora=timezone.localtime(),
        )
    logger.info('fe_de_vida.enviar_recordatorios: %s aviso(s) solicitado(s)', avisos)
    return avisos
