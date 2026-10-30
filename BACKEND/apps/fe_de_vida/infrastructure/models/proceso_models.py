"""Modelos ORM NUEVOS (managed=True) de los procesos de fe de vida y sus prórrogas (PLAN §2.2, C1)."""
from django.db import models

from core.infrastructure.models.base import BaseModel


class ProcesoFeDeVidaModel(BaseModel):
    class Estado(models.TextChoices):
        BORRADOR = 'BORRADOR'
        ABIERTO = 'ABIERTO'
        CERRADO = 'CERRADO'

    nombre = models.CharField(max_length=160)
    fecha_apertura = models.DateTimeField()
    fecha_cierre = models.DateTimeField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.BORRADOR, db_index=True)
    creado_por = models.CharField(max_length=15, blank=True, default='')
    abierto_por = models.CharField(max_length=15, blank=True, default='')
    cerrado_por = models.CharField(max_length=15, blank=True, default='')
    fecha_cierre_real = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'fe_de_vida_proceso'
        ordering = ['-fecha_apertura']
        verbose_name = 'proceso de fe de vida'
        verbose_name_plural = 'procesos de fe de vida'
        indexes = [models.Index(fields=['estado', 'fecha_cierre'], name='fv_proc_estado_cierre_idx')]

    def __str__(self) -> str:
        return f'{self.nombre} ({self.estado})'


class ProrrogaProcesoModel(BaseModel):
    """Inmutable. `cedula` vacía = prórroga general (todos los pasivos)."""

    proceso = models.ForeignKey(ProcesoFeDeVidaModel, on_delete=models.PROTECT, related_name='prorrogas')
    cedula = models.CharField(max_length=15, blank=True, default='', db_index=True)
    nueva_fecha_limite = models.DateTimeField()
    motivo = models.TextField()
    concedida_por = models.CharField(max_length=15)

    class Meta:
        db_table = 'fe_de_vida_prorroga_proceso'
        ordering = ['created_at']
        verbose_name = 'prórroga de proceso'
        verbose_name_plural = 'prórrogas de proceso'

    def __str__(self) -> str:
        return f'Prórroga({self.cedula or "general"} hasta {self.nueva_fecha_limite:%Y-%m-%d})'
