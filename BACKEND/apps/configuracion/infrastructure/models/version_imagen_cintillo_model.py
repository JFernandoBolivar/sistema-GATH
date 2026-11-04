"""
Histórico de versiones de las imágenes del cintillo. Tabla propia `managed=True`.
La imagen vigente sigue en `ConfiguracionVisualModel.<campo>`; aquí se guardan
las últimas 5 por campo y cuál es la vigente.
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class VersionImagenCintilloModel(BaseModel):
    campo = models.CharField(max_length=30)
    clave = models.CharField(max_length=255)
    mime = models.CharField(max_length=100, default='application/octet-stream')
    tamano = models.PositiveIntegerField(default=0)
    subido_por_id = models.IntegerField(null=True, blank=True)
    subido_por_cedula = models.CharField(max_length=20, blank=True, default='')
    es_vigente = models.BooleanField(default=False)

    class Meta:
        db_table = 'configuracion_version_imagen_cintillo'
        ordering = ['-created_at']
        verbose_name = 'versión de imagen del cintillo'
        verbose_name_plural = 'versiones de imágenes del cintillo'
        indexes = [models.Index(fields=['campo', '-created_at'])]

    def __str__(self) -> str:
        return f'{self.campo}:{self.clave}'
