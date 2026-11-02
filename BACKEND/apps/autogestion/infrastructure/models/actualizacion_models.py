"""
Modelos ORM NUEVOS (managed=True) de la autogestión por solicitud (PLAN_PRIORIDAD §2.3, B1, B13).

Las tablas del trabajador (Employee, vivienda, formación, familiares, contacto de emergencia)
son legadas y NO se alteran: aquí solo viven la solicitud, sus cambios propuestos, soportes y la
tabla complementaria. La cédula se guarda como texto (sin FK dura a la legada).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class SolicitudActualizacionModel(BaseModel):
    class Estado(models.TextChoices):
        SOLICITADA = 'SOLICITADA'
        HABILITADA = 'HABILITADA'
        ENVIADA = 'ENVIADA'
        DEVUELTA = 'DEVUELTA'
        APROBADA = 'APROBADA'
        APROBADA_PARCIAL = 'APROBADA_PARCIAL'
        RECHAZADA = 'RECHAZADA'
        EXPIRADA = 'EXPIRADA'

    cedula = models.CharField(max_length=15, db_index=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.SOLICITADA)
    secciones_solicitadas = models.JSONField(default=list)
    secciones_habilitadas = models.JSONField(default=list, blank=True)
    motivo = models.TextField()
    ventana_inicio = models.DateTimeField(null=True, blank=True)
    ventana_fin = models.DateTimeField(null=True, blank=True)
    plazo_dias = models.PositiveSmallIntegerField(null=True, blank=True)
    habilitada_por = models.CharField(max_length=15, blank=True, default='')
    decidida_por = models.CharField(max_length=15, blank=True, default='')
    motivo_decision = models.TextField(blank=True, default='')
    version = models.PositiveIntegerField(default=1)
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_decision = models.DateTimeField(null=True, blank=True)
    campos_solicitados = models.JSONField(default=list, blank=True)  # `entidad.campo` (decisión G)
    campos_habilitados = models.JSONField(default=list, blank=True)
    motivo_devolucion = models.TextField(blank=True, default='')
    devuelta_por = models.CharField(max_length=15, blank=True, default='')
    fecha_devolucion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'autogestion_solicitud_actualizacion'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['cedula', 'estado'], name='ag_sol_cedula_estado_idx'),
            models.Index(fields=['estado', 'ventana_fin'], name='ag_sol_estado_fin_idx'),
        ]

    def __str__(self) -> str:
        return f'Solicitud({self.cedula}, {self.estado})'


class SeccionAbiertaModel(BaseModel):
    """Reserva: una solicitud abierta por trabajador y sección (restricción única)."""

    solicitud = models.ForeignKey(SolicitudActualizacionModel, on_delete=models.CASCADE, related_name='reservas')
    cedula = models.CharField(max_length=15)
    seccion = models.CharField(max_length=30)

    class Meta:
        db_table = 'autogestion_seccion_abierta'
        constraints = [
            models.UniqueConstraint(fields=['cedula', 'seccion'], name='ag_seccion_abierta_unica'),
        ]


class ProrrogaVentanaModel(BaseModel):
    """Inmutable: la ventana vigente es la última prórroga."""

    solicitud = models.ForeignKey(SolicitudActualizacionModel, on_delete=models.PROTECT, related_name='prorrogas')
    fecha_fin_anterior = models.DateTimeField()
    fecha_fin_nueva = models.DateTimeField()
    motivo = models.TextField()
    prorrogada_por = models.CharField(max_length=15)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'autogestion_prorroga_ventana'
        ordering = ['fecha']


class CambioPropuestoModel(BaseModel):
    """Compartido con la fe de vida (`origen_tipo`): un MODIFICAR es un campo; un CREAR, un registro ('*')."""

    class Decision(models.TextChoices):
        PENDIENTE = 'PENDIENTE'
        APROBADO = 'APROBADO'
        RECHAZADO = 'RECHAZADO'

    origen_tipo = models.CharField(max_length=20)  # ACTUALIZACION | FE_DE_VIDA
    origen_id = models.UUIDField()
    seccion = models.CharField(max_length=30)
    accion = models.CharField(max_length=10)  # MODIFICAR | CREAR
    entidad_destino = models.CharField(max_length=40)
    entidad_id = models.CharField(max_length=32, null=True, blank=True)
    campo = models.CharField(max_length=60)
    valor_anterior = models.JSONField(null=True, blank=True)
    valor_propuesto = models.JSONField(null=True, blank=True)
    decision = models.CharField(max_length=10, choices=Decision.choices, default=Decision.PENDIENTE)
    motivo_decision = models.TextField(blank=True, default='')
    decidido_por = models.CharField(max_length=15, blank=True, default='')
    fecha_decision = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'autogestion_cambio_propuesto'
        ordering = ['created_at']
        indexes = [models.Index(fields=['origen_tipo', 'origen_id'], name='ag_cambio_origen_idx')]


class SoporteDocumentalModel(BaseModel):
    origen_tipo = models.CharField(max_length=20)
    origen_id = models.UUIDField()
    seccion = models.CharField(max_length=30)
    tipo = models.CharField(max_length=20)  # TITULO|ACTA_NACIMIENTO|CONSTANCIA|FOTO|OTRO
    clave_s3 = models.CharField(max_length=255)
    mime_real = models.CharField(max_length=60)
    tamano_bytes = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64)
    nombre_original = models.CharField(max_length=200, blank=True, default='')
    subido_por = models.CharField(max_length=15)

    class Meta:
        db_table = 'autogestion_soporte_documental'
        ordering = ['created_at']
        indexes = [models.Index(fields=['origen_tipo', 'origen_id'], name='ag_soporte_origen_idx')]


class SeccionAutogestionableModel(BaseModel):
    """Catálogo configurable. Sin `requiere_doble_aprobacion`: la autogestión la aprueba UNA persona."""

    codigo = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=120)
    requiere_soporte = models.BooleanField(default=False)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = 'autogestion_seccion_autogestionable'
        ordering = ['created_at', 'codigo']


class DatosComplementariosTrabajadorModel(BaseModel):
    """B13: correo alternativo y «¿tiene hijos?». `Employee` (legada) no tiene dónde guardarlos."""

    cedula = models.CharField(max_length=15, unique=True)
    correo_alternativo = models.EmailField(null=True, blank=True)  # puede repetirse (p. ej. correo familiar)
    tiene_hijos = models.BooleanField(null=True, blank=True)  # nulo = sin declarar
    actualizado_en = models.DateTimeField(auto_now=True)
    actualizado_por = models.CharField(max_length=15, blank=True, default='')

    class Meta:
        db_table = 'datos_complementarios_trabajador'
