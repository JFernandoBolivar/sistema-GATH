"""
Modelo ORM para Reporte de Error en Datos Laborales (A11 / Regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class ReporteErrorDatoLaboralModel(BaseModel):
    trabajador_cedula = models.CharField(max_length=15, db_index=True)
    trabajador_nombre = models.CharField(max_length=200, blank=True, default='')
    dato = models.CharField(
        max_length=30,
        choices=[
            ('cargo', 'Cargo'),
            ('oficina', 'Oficina / Gerencia'),
            ('fecha_ingreso', 'Fecha de ingreso'),
            ('otro', 'Otro'),
        ],
        db_index=True,
    )
    descripcion = models.CharField(max_length=500)
    estado = models.CharField(
        max_length=20,
        choices=[('PENDIENTE', 'Pendiente'), ('ATENDIDO', 'Atendido')],
        default='PENDIENTE',
        db_index=True,
    )
    atendido_por_id = models.IntegerField(null=True, blank=True)
    atendido_por_cedula = models.CharField(max_length=20, blank=True, default='')
    atendido_por_nombre = models.CharField(max_length=150, blank=True, default='')
    atendido_el = models.DateTimeField(null=True, blank=True)
    observacion_atencion = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'personal_reporte_error_dato_laboral'
        ordering = ['-created_at']
        verbose_name = 'reporte de error laboral'
        verbose_name_plural = 'reportes de error laboral'
        indexes = [
            models.Index(fields=['estado', 'created_at']),
            models.Index(fields=['trabajador_cedula', 'estado']),
        ]

    def __str__(self) -> str:
        return f"Reporte {self.id} ({self.trabajador_cedula} - {self.dato}: {self.estado})"
