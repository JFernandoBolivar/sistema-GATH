"""
Modelo de credenciales externas y temporales (O45-A).

Cubre visitantes, contratistas/proveedores y credenciales temporales de
trabajadores (olvido/extravío). Es una tabla nueva y gestionada: no modifica
la tabla legada `CarnetEmitido` ni los carnets de trabajadores/pasivos.
"""
from django.conf import settings
from django.db import models

from core.infrastructure.models.base import BaseModel


class CredencialExternaModel(BaseModel):
    """Credencial emitida a una persona que no es un trabajador activo/pasivo."""

    class Estado(models.TextChoices):
        ACTIVA = 'ACTIVA', 'Activa'
        DEVUELTA = 'DEVUELTA', 'Devuelta'
        ANULADA = 'ANULADA', 'Anulada'
        VENCIDA = 'VENCIDA', 'Vencida'

    tipo_credencial = models.ForeignKey(
        'carnetizacion.TipoCredencialModel',
        on_delete=models.PROTECT,
        related_name='credenciales_externas',
        db_column='tipoCredencialCodigo',
    )
    empleado = models.ForeignKey(
        'personal.EmployeeModel',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='credenciales_externas',
        db_column='empleadoId',
    )
    nombre = models.CharField(max_length=150)
    documento = models.CharField(max_length=50, db_index=True)
    correo = models.EmailField(max_length=254, blank=True, default='')
    empresa = models.CharField(max_length=150, blank=True, default='')
    contrato = models.CharField(max_length=100, blank=True, default='')
    persona_visitada = models.CharField(max_length=150, blank=True, default='')
    motivo = models.CharField(max_length=200)
    vigencia_desde = models.DateTimeField()
    vigencia_hasta = models.DateTimeField(db_index=True)
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.ACTIVA, db_index=True
    )
    security_hash = models.CharField(max_length=64, unique=True, db_index=True)
    datos = models.JSONField(default=dict, blank=True)
    plantilla_id = models.CharField(max_length=64, blank=True, default='')
    plantilla_version = models.PositiveIntegerField(null=True, blank=True)
    plantilla_snapshot = models.JSONField(null=True, blank=True)
    observaciones = models.TextField(blank=True, default='')
    devuelta_en = models.DateTimeField(null=True, blank=True)
    anulada_en = models.DateTimeField(null=True, blank=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        db_column='creadoPorId',
    )

    class Meta:
        db_table = 'CarnetCredencialExterna'
        ordering = ['-created_at']
        verbose_name = 'credencial externa o temporal'
        verbose_name_plural = 'credenciales externas o temporales'
        indexes = [
            models.Index(fields=['estado', 'vigencia_hasta'], name='cce_estado_vig_idx'),
            models.Index(fields=['tipo_credencial', 'created_at'], name='cce_tipo_creado_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.documento}) — {self.tipo_credencial_id} [{self.estado}]"
