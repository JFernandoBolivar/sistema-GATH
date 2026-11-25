"""Modelos ORM NUEVOS (managed=True) de Presupuesto y Dirección General: reserva de puesto, constancia presupuestaria
y enlace con el Punto de Cuenta de ingreso (E-2, E-3, E-5)."""
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.postulacion.domain.entities.punto_cuenta_ingreso import ESTADOS_PUNTO_CUENTA
from apps.postulacion.domain.entities.reserva import ACTIVA, ESTADOS_RESERVA
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from core.infrastructure.models.base import BaseModel


class ReservaPuestoModel(BaseModel):
    """Impide que dos expedientes tomen el mismo puesto. `puesto_id` apunta a `AsigTrabajo` (tabla heredada) SIN FK dura."""

    ESTADOS = [(e, e) for e in ESTADOS_RESERVA]

    expediente = models.ForeignKey(ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='reservas')
    puesto_id = models.PositiveIntegerField(db_index=True)
    reservado_por = models.CharField(max_length=15, blank=True, default='')
    reservado_el = models.DateTimeField(default=timezone.now)
    vence_el = models.DateTimeField(db_index=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ACTIVA)
    motivo_liberacion = models.CharField(max_length=200, blank=True, default='')
    cerrada_el = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'postulacion_reserva_puesto'
        ordering = ['-reservado_el']
        verbose_name = 'reserva de puesto'
        verbose_name_plural = 'reservas de puesto'
        indexes = [models.Index(fields=['estado', 'vence_el'], name='postul_reserva_est_vence_idx')]
        constraints = [
            models.UniqueConstraint(
                fields=['puesto_id'], condition=Q(estado=ACTIVA), name='postul_reserva_una_activa_por_puesto',
            ),
            models.UniqueConstraint(
                fields=['expediente'], condition=Q(estado=ACTIVA), name='postul_reserva_una_activa_por_expediente',
            ),
            models.CheckConstraint(condition=Q(estado__in=list(ESTADOS_RESERVA)), name='postul_reserva_estado_valido'),
        ]

    def __str__(self) -> str:
        return f'{self.expediente_id} -> puesto {self.puesto_id} ({self.estado})'


class ConstanciaPresupuestariaModel(BaseModel):
    """Resultado de la gestión externa de disponibilidad; el sistema NO la calcula. Una por expediente."""

    expediente = models.OneToOneField(
        ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='constancia_presupuestaria',
    )
    declarado_por_cedula = models.CharField(max_length=15)
    declarado_por_nombre = models.CharField(max_length=200, blank=True, default='')
    referencia = models.CharField(max_length=100)  # número de partida u oficio
    fecha = models.DateTimeField(default=timezone.now)
    observaciones = models.TextField(blank=True, default='')
    # Adjunto PDF opcional en el almacén: clave opaca (sin la cédula), huella y tamaño.
    adjunto_clave = models.CharField(max_length=200, blank=True, default='')
    adjunto_sha256 = models.CharField(max_length=64, blank=True, default='')
    adjunto_tamano = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'postulacion_constancia_presupuestaria'
        verbose_name = 'constancia presupuestaria'
        verbose_name_plural = 'constancias presupuestarias'

    def __str__(self) -> str:
        return f'{self.expediente_id} {self.referencia}'


class PuntoCuentaIngresoModel(BaseModel):
    """Enlace expediente -> Punto de Cuenta de ingreso de `apps.puntocuenta` (por id y número, sin FK entre módulos)."""

    ESTADOS = [(e, e) for e in ESTADOS_PUNTO_CUENTA]

    expediente = models.OneToOneField(
        ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='punto_cuenta_ingreso',
    )
    punto_cuenta_id = models.UUIDField(db_index=True)
    numero = models.CharField(max_length=30, blank=True, default='')
    pdf_clave = models.CharField(max_length=255, blank=True, default='')
    estado = models.CharField(max_length=10, choices=ESTADOS)
    puesto_id = models.PositiveIntegerField()
    referencia_constancia = models.CharField(max_length=100, blank=True, default='')
    emitido_por = models.CharField(max_length=15, blank=True, default='')
    emitido_el = models.DateTimeField(default=timezone.now)
    decidido_por = models.CharField(max_length=15, blank=True, default='')
    decidido_el = models.DateTimeField(null=True, blank=True)
    # M-1: aprobación firmada fuera del sistema (fecha de la firma y PDF escaneado opcional, clave opaca).
    aprobado_fuera_sistema = models.BooleanField(default=False)
    fecha_firma = models.DateField(null=True, blank=True)
    registrado_por_nombre = models.CharField(max_length=200, blank=True, default='')
    pdf_firmado_clave = models.CharField(max_length=255, blank=True, default='')
    pdf_firmado_sha256 = models.CharField(max_length=64, blank=True, default='')
    pdf_firmado_tamano = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'postulacion_punto_cuenta_ingreso'
        verbose_name = 'punto de cuenta de ingreso'
        verbose_name_plural = 'puntos de cuenta de ingreso'
        constraints = [
            models.CheckConstraint(
                condition=Q(estado__in=list(ESTADOS_PUNTO_CUENTA)), name='postul_pc_ingreso_estado_valido',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.expediente_id} PC {self.numero} ({self.estado})'
