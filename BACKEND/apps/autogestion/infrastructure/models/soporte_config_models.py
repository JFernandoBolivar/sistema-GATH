"""
Modelos ORM del catálogo configurable de tipos de soporte (O41).

`managed = False`: las tablas se crean con la migración aditiva
`core/0018_tipos_documento_configurables.py`, igual que el resto de catálogos
legados.
"""
from django.db import models


class TipoSoporteDocumentoModel(models.Model):
    codigo = models.CharField(max_length=40, unique=True)
    nombre = models.CharField(max_length=100)
    es_reservado = models.BooleanField(default=False)
    es_protegido = models.BooleanField(default=False)
    orden = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = 'TipoSoporteDocumento'
        ordering = ['orden', 'nombre']
        verbose_name = 'tipo de soporte'
        verbose_name_plural = 'tipos de soporte'

    def __str__(self) -> str:
        return self.nombre


class ChecklistSoporteSeccionModel(models.Model):
    seccion = models.CharField(max_length=40)
    tipo_soporte = models.ForeignKey(
        TipoSoporteDocumentoModel,
        on_delete=models.CASCADE,
        db_column='tipo_soporte_id',
        related_name='secciones',
    )
    etiqueta = models.CharField(max_length=100, blank=True, default='')
    permitido = models.BooleanField(default=True)
    requerido = models.BooleanField(default=False)
    orden = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = 'ChecklistSoporteSeccion'
        ordering = ['seccion', 'orden', 'tipo_soporte__nombre']
        unique_together = (('seccion', 'tipo_soporte'),)
        verbose_name = 'checklist de soporte por sección'
        verbose_name_plural = 'checklist de soportes por sección'

    def __str__(self) -> str:
        return f'{self.seccion}: {self.tipo_soporte.codigo}'
