"""
Modelo ORM de auditoría dual — destino Base de Datos (B2.8, D-04, §I.4.7).

La tabla es append-only desde el punto de vista de la aplicación: no se
expone ningún endpoint de actualización o borrado sobre `AuditoriaLog`.
"""
from django.db import models

from core.infrastructure.models.base import uuid7


class AuditoriaLog(models.Model):
    """Registro append-only de auditoría de mutaciones y accesos sensibles."""

    class Resultado(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Éxito'
        FAILED = 'FAILED', 'Fallido'
        DENIED = 'DENIED', 'Denegado'

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    trace_id = models.CharField(max_length=64, db_index=True)
    actor_id = models.IntegerField(null=True, blank=True)
    actor_cedula = models.CharField(max_length=15, blank=True, default='')
    actor_rol = models.CharField(max_length=50, blank=True, default='')
    modulo = models.CharField(max_length=50, db_index=True)
    accion = models.CharField(max_length=100, db_index=True)
    recurso_tipo = models.CharField(max_length=50, blank=True, default='')
    recurso_id = models.CharField(max_length=64, blank=True, default='')
    ip_origen = models.GenericIPAddressField(null=True, blank=True)
    estado_previo = models.JSONField(null=True, blank=True)
    estado_nuevo = models.JSONField(null=True, blank=True)
    resultado = models.CharField(max_length=20, choices=Resultado.choices, default=Resultado.SUCCESS)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'auditoria_log'
        ordering = ['-fecha_hora']
        indexes = [
            models.Index(fields=['modulo', 'accion']),
            models.Index(fields=['trace_id']),
        ]

    def __str__(self) -> str:
        return f'[{self.fecha_hora}] {self.modulo}.{self.accion} — {self.resultado}'
