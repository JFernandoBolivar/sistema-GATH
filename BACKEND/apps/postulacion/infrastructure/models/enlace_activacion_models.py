"""Modelo ORM del enlace de activación del postulante (D-10). Solo el hash del token; nunca el token."""
from django.db import models
from django.utils import timezone

from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from core.infrastructure.models.base import BaseModel


class EnlaceActivacionModel(BaseModel):
    expediente = models.ForeignKey(
        ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='enlaces_activacion',
    )
    token_hash = models.CharField(max_length=64, unique=True)  # sha256 hexadecimal del token
    correo_destino = models.CharField(max_length=254)
    creado_por = models.CharField(max_length=15, blank=True, default='')  # cédula del analista de Captación
    creado_el = models.DateTimeField(default=timezone.now)
    vence_el = models.DateTimeField()
    usado_el = models.DateTimeField(null=True, blank=True)
    ip_uso = models.GenericIPAddressField(null=True, blank=True)
    intentos = models.PositiveSmallIntegerField(default=0)
    revocado = models.BooleanField(default=False)

    class Meta:
        db_table = 'postulacion_enlace_activacion'
        verbose_name = 'enlace de activación'
        verbose_name_plural = 'enlaces de activación'
        indexes = [models.Index(fields=['expediente', '-creado_el'], name='post_enlace_exp_creado_idx')]

    def __str__(self) -> str:
        return f'enlace de {self.expediente_id} (vence {self.vence_el:%Y-%m-%d %H:%M})'
