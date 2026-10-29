"""
Outbox transaccional de correo — tabla NUEVA managed=True (PLAN_PRIORIDAD §2.3 y §2.5).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class EventoOutboxModel(BaseModel):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE'
        ENVIADO = 'ENVIADO'
        FALLIDO = 'FALLIDO'

    tipo = models.CharField(max_length=60)
    canal = models.CharField(max_length=10, default='EMAIL')
    destinatario = models.CharField(max_length=254)          # correo
    destinatario_cedula = models.CharField(max_length=20, blank=True, default='')
    # asunto, titulo, mensaje, enlace, copia_a[], adjuntos[{nombre,mime,clave_almacen|contenido_b64}]
    payload = models.JSONField(default=dict)
    idempotency_key = models.CharField(max_length=250, unique=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    intentos = models.PositiveSmallIntegerField(default=0)
    proximo_intento = models.DateTimeField(null=True, blank=True)
    ultimo_error = models.TextField(blank=True, default='')
    enviado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notificaciones_evento_outbox'
        ordering = ['created_at']
        indexes = [models.Index(fields=['estado', 'proximo_intento'], name='outbox_estado_prox_idx')]

    def __str__(self) -> str:
        return f'Outbox({self.tipo}, {self.estado})'
