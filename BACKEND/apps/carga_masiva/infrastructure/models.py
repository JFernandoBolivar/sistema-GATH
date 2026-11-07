"""Modelos de la carga masiva (O28-F2/F4, FIX-CARGA1)."""
from django.db import models

from core.infrastructure.models.base import BaseModel


class CargaMasivaModel(BaseModel):
    class Estado(models.TextChoices):
        EN_ANALISIS = 'EN_ANALISIS'
        ANALIZADA = 'ANALIZADA'
        APLICANDO = 'APLICANDO'
        APLICADA = 'APLICADA'
        PENDIENTE_APROBACION = 'PENDIENTE_APROBACION'
        RECHAZADA = 'RECHAZADA'
        ERROR = 'ERROR'
        REVERTIDA = 'REVERTIDA'

    class Poblacion(models.TextChoices):
        ACTIVOS = 'ACTIVOS'
        PASIVOS = 'PASIVOS'

    archivo_nombre = models.CharField(max_length=255)
    archivo_clave = models.CharField(max_length=255, blank=True, default='')
    tamano_bytes = models.PositiveBigIntegerField(default=0)
    poblacion = models.CharField(
        max_length=10, choices=Poblacion.choices, default=Poblacion.ACTIVOS,
    )
    tipos = models.JSONField(default=list, blank=True)
    modo = models.CharField(max_length=20, default='obligatorios')
    estado = models.CharField(max_length=24, choices=Estado.choices, default=Estado.EN_ANALISIS)
    filas_total = models.PositiveIntegerField(default=0)
    filas_validas = models.PositiveIntegerField(default=0)
    filas_error = models.PositiveIntegerField(default=0)
    filas_confirmacion = models.PositiveIntegerField(default=0)
    filas_confirmadas = models.PositiveIntegerField(default=0)
    solicitada_por_cedula = models.CharField(max_length=15, blank=True, default='')
    aprobada_por_cedula = models.CharField(max_length=15, blank=True, default='')
    motivo_rechazo = models.TextField(blank=True, default='')
    analizada_en = models.DateTimeField(null=True, blank=True)
    aplicada_en = models.DateTimeField(null=True, blank=True)
    revertida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'carga_masiva'
        ordering = ['-created_at']

    @property
    def modulo(self) -> str:
        return 'pasivos' if self.poblacion == self.Poblacion.PASIVOS else 'personal'


class CargaMasivaFilaModel(BaseModel):
    class Estado(models.TextChoices):
        NUEVO = 'NUEVO'
        ACTUALIZAR = 'ACTUALIZAR'
        SIN_CAMBIOS = 'SIN_CAMBIOS'
        ADVERTENCIA = 'ADVERTENCIA'
        REQUIERE_CONFIRMACION = 'REQUIERE_CONFIRMACION'
        ERROR = 'ERROR'

    carga = models.ForeignKey(CargaMasivaModel, on_delete=models.CASCADE, related_name='filas')
    hoja = models.CharField(max_length=40)
    tipo = models.CharField(max_length=40)
    numero_fila = models.PositiveIntegerField()
    estado = models.CharField(max_length=24, choices=Estado.choices)
    detalle = models.TextField(blank=True, default='')
    datos = models.JSONField(default=dict, blank=True)
    anteriores = models.JSONField(default=dict, blank=True)
    # FIX-CARGA1: resumen del movimiento de cambio de condición propuesto. Se
    # guarda en la fila que lo origina y se copia a las demás filas de la misma
    # cédula para que el aprobador y el diálogo de confirmación lo muestren.
    movimiento = models.JSONField(default=dict, blank=True)
    confirmada = models.BooleanField(default=False)
    confirmada_por_cedula = models.CharField(max_length=15, blank=True, default='')
    confirmada_en = models.DateTimeField(null=True, blank=True)
    aplicada = models.BooleanField(default=False)
    error_aplicacion = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'carga_masiva_fila'
        ordering = ['numero_fila']
