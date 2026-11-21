"""Modelos ORM NUEVOS (managed=True) del postulante, su expediente y el historial de transiciones (D-1)."""
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.postulacion.domain.value_objects.estados import VALORES_TERMINALES, EstadoExpediente
from core.infrastructure.models.base import BaseModel


class PostulanteModel(BaseModel):
    """Agregado independiente: NO es Employee. `employee_cedula` = empleado previo (reingreso, C-1), sin FK dura."""

    cedula = models.CharField(max_length=15, unique=True)
    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150)
    correo = models.EmailField(blank=True, default='')
    telefono_movil = models.CharField(max_length=20, blank=True, default='')
    employee_cedula = models.CharField(max_length=15, blank=True, default='', db_index=True)
    creado_por = models.CharField(max_length=15, blank=True, default='')

    class Meta:
        db_table = 'postulacion_postulante'
        ordering = ['apellidos', 'nombres']
        verbose_name = 'postulante'
        verbose_name_plural = 'postulantes'

    def __str__(self) -> str:
        return f'{self.cedula} {self.nombres} {self.apellidos}'


class ExpedientePostulacionModel(BaseModel):
    ESTADOS = [(e.value, e.value) for e in EstadoExpediente]

    numero = models.CharField(max_length=20, unique=True)  # EXP-2026-00001
    postulante = models.ForeignKey(PostulanteModel, on_delete=models.PROTECT, related_name='expedientes')
    estado = models.CharField(max_length=30, choices=ESTADOS, db_index=True)
    creado_por = models.CharField(max_length=15, blank=True, default='')
    # Propuesta de Captación: ids de catálogos heredados SIN FK dura, y/o texto libre.
    cargo_propuesto_id = models.PositiveIntegerField(null=True, blank=True)
    cargo_especifico_propuesto_id = models.PositiveIntegerField(null=True, blank=True)
    tipo_nomina_propuesto_id = models.PositiveIntegerField(null=True, blank=True)
    direccion_general_id = models.PositiveIntegerField(null=True, blank=True)
    direccion_linea_id = models.PositiveIntegerField(null=True, blank=True)
    coordinacion_id = models.PositiveIntegerField(null=True, blank=True)
    dependencia_id = models.PositiveIntegerField(null=True, blank=True)
    cargo_propuesto_texto = models.CharField(max_length=200, blank=True, default='')
    oficina_propuesta_texto = models.CharField(max_length=200, blank=True, default='')
    ventana = models.PositiveSmallIntegerField(null=True, blank=True)
    ventana_vence_el = models.DateTimeField(null=True, blank=True, db_index=True)
    reserva_vence_el = models.DateTimeField(null=True, blank=True)
    diferido_vence_el = models.DateTimeField(null=True, blank=True)
    observaciones = models.TextField(blank=True, default='')
    datos_ventana1 = models.JSONField(default=dict, blank=True)  # formulario de la Ventana 1 (esquema en el dominio)
    fecha_apertura = models.DateTimeField(default=timezone.now)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'postulacion_expediente'
        ordering = ['-fecha_apertura']
        verbose_name = 'expediente de postulación'
        verbose_name_plural = 'expedientes de postulación'
        indexes = [models.Index(fields=['estado', 'fecha_apertura'], name='postul_exp_estado_apert_idx')]
        constraints = [
            # Un postulante no puede tener dos expedientes ABIERTOS (no terminales) a la vez.
            models.UniqueConstraint(
                fields=['postulante'], condition=~Q(estado__in=VALORES_TERMINALES),
                name='postul_un_expediente_abierto_por_postulante',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.numero} ({self.estado})'


class TransicionExpedienteModel(BaseModel):
    """Auditoría inmutable: una fila por cambio de estado. Nunca se actualiza ni se borra."""

    expediente = models.ForeignKey(ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='transiciones')
    estado_origen = models.CharField(max_length=30, blank=True, default='')  # vacío = alta del expediente
    estado_destino = models.CharField(max_length=30)
    actor_cedula = models.CharField(max_length=15, blank=True, default='')  # vacío = sistema
    actor_tipo = models.CharField(max_length=12, default='USUARIO')
    fecha = models.DateTimeField(default=timezone.now)
    motivo = models.TextField(blank=True, default='')
    datos_extra = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'postulacion_transicion_expediente'
        ordering = ['fecha', 'created_at']
        verbose_name = 'transición de expediente'
        verbose_name_plural = 'transiciones de expediente'
        indexes = [models.Index(fields=['expediente', 'fecha'], name='postul_trans_exp_fecha_idx')]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError('El historial de transiciones es inmutable: no se actualiza.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('El historial de transiciones es inmutable: no se borra.')

    def __str__(self) -> str:
        return f'{self.estado_origen or "-"} -> {self.estado_destino}'
