"""
Notificación en el sistema (campana/bandeja) — tabla NUEVA managed=True (PLAN_PRIORIDAD §2.3).

La cédula se guarda como texto (sin FK dura a la tabla legada), igual que el resto de módulos nuevos.
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class NotificacionModel(BaseModel):
    destinatario_cedula = models.CharField(max_length=20)
    tipo = models.CharField(max_length=60)
    titulo = models.CharField(max_length=200)
    mensaje = models.TextField()
    enlace = models.CharField(max_length=300, blank=True, default='')  # ruta interna relativa
    ref_tipo = models.CharField(max_length=40, blank=True, default='')
    ref_id = models.CharField(max_length=64, blank=True, default='')
    leida = models.BooleanField(default=False)
    fecha_lectura = models.DateTimeField(null=True, blank=True)
    # Dedupe por destinatario: el mismo hecho no genera dos avisos (nulo = sin dedupe).
    clave_unica = models.CharField(max_length=160, null=True, blank=True)

    class Meta:
        db_table = 'notificaciones_notificacion'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['destinatario_cedula', 'leida', '-created_at'], name='notif_dest_leida_idx'),
            models.Index(fields=['ref_tipo', 'ref_id'], name='notif_ref_idx'),
        ]
        constraints = [
            models.UniqueConstraint(fields=['destinatario_cedula', 'clave_unica'], name='notif_dest_clave_unica'),
        ]

    def __str__(self) -> str:
        return f'Notificacion({self.destinatario_cedula}, {self.tipo})'
