"""
Re-exportador de modelos ORM del módulo notificaciones (Regla B26).
"""
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel

__all__ = ['NotificacionModel', 'EventoOutboxModel']
