"""
Trabajo de exportación asíncrona — tabla NUEVA managed=True.

El estado vive en base de datos (no en Redis) porque debe sobrevivir a un
reinicio del broker, permite verificar el dueño en cada consulta, conserva el
rastro de errores y es lo que recorre la limpieza. El solicitante se guarda como
entero/cédula (sin FK dura), igual que el resto de módulos nuevos.
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class TrabajoExportacionModel(BaseModel):
    solicitante_id = models.IntegerField(null=True, blank=True)
    solicitante_cedula = models.CharField(max_length=20, blank=True, default='')
    tipo = models.CharField(max_length=40)
    formato = models.CharField(max_length=10)
    estado = models.CharField(max_length=12, default='PENDIENTE')
    progreso = models.PositiveSmallIntegerField(default=0)
    parametros = models.JSONField(default=dict)
    task_id = models.CharField(max_length=64, blank=True, default='')
    clave_archivo = models.CharField(max_length=200, blank=True, default='')
    nombre_archivo = models.CharField(max_length=120, blank=True, default='')
    tamano_bytes = models.BigIntegerField(default=0)
    metadatos = models.JSONField(default=dict)
    error = models.CharField(max_length=300, blank=True, default='')
    expira_en = models.DateTimeField()
    finalizado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'exportaciones_trabajo'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['solicitante_id', 'estado'], name='export_solic_estado_idx'),
            models.Index(fields=['estado', 'expira_en'], name='export_estado_expira_idx'),
        ]

    def __str__(self) -> str:
        return f'Exportacion({self.tipo}.{self.formato}, {self.estado})'
