"""
Tarea Celery de la recuperación de contraseña (caja negra 2026-11-03).

La vista respondía después de enviar el correo por SMTP: unos 5 s si la cuenta
existía y 0,02 s si no, lo que permitía averiguar qué correos o cédulas están
registrados midiendo el tiempo. Además, solo una cuenta existente podía recibir
el error de SMTP. Ahora la vista encola esta tarea y responde al instante con
el mensaje genérico; la búsqueda, el token y el envío ocurren en el worker.

Por el broker solo viaja el identificador escrito por el usuario y la URL base
de confianza: el token se genera aquí, nunca se encola.
"""
import logging

from celery import shared_task

from apps.identidad.application.use_cases.solicitar_recuperacion_password import (
    solicitar_recuperacion_password,
)
from apps.identidad.infrastructure.emails.recuperacion_email import enviar_correo_recuperacion
from apps.identidad.infrastructure.repositories.repo_recuperacion_password_orm import (
    RepoRecuperacionPasswordORM,
)
from apps.identidad.infrastructure.tokens.password_reset_token import generar_token_recuperacion
from core.domain.exceptions import DomainError

logger = logging.getLogger('security_backend')


def procesar_solicitud_recuperacion(identificador: str, base_frontend: str) -> None:
    """Busca la cuenta y envía el correo; los errores quedan en el log, nunca en la respuesta."""
    try:
        solicitar_recuperacion_password(
            RepoRecuperacionPasswordORM(),
            identificador,
            base_frontend=base_frontend,
            enviar_email_fn=enviar_correo_recuperacion,
            generar_token_fn=generar_token_recuperacion,
        )
    except DomainError:
        # El caso de uso ya registró el detalle (p. ej. el fallo de SMTP).
        logger.warning('recuperacion.no_enviada', exc_info=True)


@shared_task(name='identidad.solicitar_recuperacion_password', ignore_result=True)
def solicitar_recuperacion_password_task(identificador: str, base_frontend: str) -> None:
    procesar_solicitud_recuperacion(identificador, base_frontend)
