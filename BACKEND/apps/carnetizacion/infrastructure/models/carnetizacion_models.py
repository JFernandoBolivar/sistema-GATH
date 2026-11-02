"""
Modelos ORM de Carnetización (Regla B26).
"""
import hashlib
from django.conf import settings
from django.db import models


class MotivosEmisionModel(models.Model):
    nombre = models.CharField(max_length=100, unique=True, verbose_name='Motivo')

    class Meta:
        managed = False
        db_table = 'MotivosEmision'
        ordering = ['nombre']
        verbose_name = 'motivo de emisión'
        verbose_name_plural = 'motivos de emisión'

    def __str__(self) -> str:
        return self.nombre


class CarnetEmitidoModel(models.Model):
    employee = models.ForeignKey(
        'personal.EmployeeModel',
        on_delete=models.PROTECT,
        related_name='+',
        db_column='employeeId',
    )

    security_hash = models.CharField(max_length=64, unique=True, db_index=True)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    motivo = models.ForeignKey(
        MotivosEmisionModel,
        on_delete=models.PROTECT,
        db_column='motivoId',
    )
    observaciones = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'CarnetEmitido'
        ordering = ['-fecha_emision']
        verbose_name = 'carnet emitido'
        verbose_name_plural = 'carnets emitidos'

    def __str__(self) -> str:
        return f"Carnet #{self.id} - {self.employee_id}"


class CarnetTemplateModel(models.Model):
    nombre = models.CharField(max_length=100)
    imagen = models.ImageField(upload_to='carnet_templates/')
    activo = models.BooleanField(default=False)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'CarnetTemplate'
        ordering = ['-activo', '-creado']
        verbose_name = 'plantilla de carnet'
        verbose_name_plural = 'plantillas de carnet'

    def __str__(self) -> str:
        return self.nombre
