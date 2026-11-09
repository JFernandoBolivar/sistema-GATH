"""
Fábrica del servicio de notificaciones y su registro en el kernel (`core.infrastructure.providers`),
para que los demás módulos notifiquen por el puerto `Notificador` sin importar esta app (B16).
"""
from apps.notificaciones.application.use_cases.servicio_notificaciones import ServicioNotificaciones
from apps.notificaciones.infrastructure.cache_conteo_django import CacheConteoDjango
from apps.notificaciones.infrastructure.planificador_envio_celery import PlanificadorEnvioCelery
from apps.notificaciones.infrastructure.repositories.repo_notificaciones_orm import RepoNotificacionesORM
from apps.notificaciones.infrastructure.repositories.repo_outbox_orm import RepoOutboxORM
from apps.notificaciones.infrastructure.resolutor_destinatarios_orm import ResolutorDestinatariosORM
from core.infrastructure.providers import registrar_notificador


def crear_servicio_notificaciones() -> ServicioNotificaciones:
    return ServicioNotificaciones(
        RepoNotificacionesORM(), RepoOutboxORM(), ResolutorDestinatariosORM(), CacheConteoDjango(),
        PlanificadorEnvioCelery(),
    )


def registrar_notificador_en_kernel() -> None:
    registrar_notificador(crear_servicio_notificaciones())
