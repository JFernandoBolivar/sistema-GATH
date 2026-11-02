"""
Tarea periódica (celery beat): recordatorio a los trabajadores cuya ventana de actualización vence
en menos de los días configurados en `plazos.autogestion_aviso_dias` (1 día = 24 h por defecto).
Idempotente: el receptor deduplica por (solicitud, fecha fin), así que correrla cada 30 minutos no
repite el aviso.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.db import transaction

from apps.autogestion.application.use_cases.solicitud_ciclo import avisar_ventanas_por_expirar
from apps.autogestion.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesORM
from apps.autogestion.infrastructure.signals import PublicadorSenales
from core.domain.configuracion import CLAVE_AUTOGESTION_AVISO_DIAS
from core.infrastructure.providers import obtener_lector_configuracion

logger = logging.getLogger('gath.tasks')

HORAS_POR_DIA = 24


@shared_task(name='autogestion.avisar_ventanas_por_expirar', acks_late=True)
def avisar_ventanas_por_expirar_tarea() -> int:
    lector = obtener_lector_configuracion()
    dias = lector.obtener_entero(CLAVE_AUTOGESTION_AVISO_DIAS) if lector is not None else 1
    with transaction.atomic():
        avisadas = avisar_ventanas_por_expirar(
            RepoSolicitudesORM(), PublicadorSenales(), datetime.now(timezone.utc),
            dias * HORAS_POR_DIA,
        )
    logger.info('autogestion.avisar_ventanas_por_expirar: %s ventana(s) evaluada(s)', avisadas)
    return avisadas
