"""
Modelos ORM NUEVOS (managed=True) de la solicitud de fe de vida, su evidencia, decisiones, constancia
y plantilla v1 (PLAN §2.2, §2.3, C1). Las respuestas del acta NO tienen tabla propia: son
`CambioPropuestoModel` de autogestión con `origen_tipo = FE_DE_VIDA`. La cédula es texto (sin FK dura).
"""
from django.db import models

from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from core.infrastructure.models.base import BaseModel


class SolicitudFeDeVidaModel(BaseModel):
    class Estado(models.TextChoices):
        BORRADOR = 'BORRADOR'
        PENDIENTE_REVISION = 'PENDIENTE_REVISION'
        PENDIENTE_SEGUNDO_CHECK = 'PENDIENTE_SEGUNDO_CHECK'
        VALIDADA = 'VALIDADA'
        RECHAZADA = 'RECHAZADA'
        DEVUELTA = 'DEVUELTA'
        EXPIRADA = 'EXPIRADA'
        ARCHIVADA = 'ARCHIVADA'

    class Origen(models.TextChoices):
        CAMARA = 'CAMARA'
        ARCHIVO = 'ARCHIVO'

    class Via(models.TextChoices):
        DOBLE_CHECK = 'DOBLE_CHECK'
        DIRECTA_ADMINISTRADORA = 'DIRECTA_ADMINISTRADORA'

    proceso = models.ForeignKey(ProcesoFeDeVidaModel, on_delete=models.PROTECT, related_name='solicitudes')
    cedula = models.CharField(max_length=15, db_index=True)
    estado = models.CharField(max_length=24, choices=Estado.choices, default=Estado.BORRADOR)
    version = models.PositiveIntegerField(default=1)
    envios = models.PositiveSmallIntegerField(default=0)
    origen_evidencia = models.CharField(max_length=10, choices=Origen.choices, blank=True, default='')
    evidencia_clave = models.CharField(max_length=255, blank=True, default='')
    evidencia_sha256 = models.CharField(max_length=64, blank=True, default='')
    evidencia_mime = models.CharField(max_length=60, blank=True, default='')
    evidencia_tamano = models.PositiveBigIntegerField(default=0)
    metadatos_captura = models.JSONField(default=dict, blank=True)
    evidencias_previas = models.JSONField(default=list, blank=True)
    via_aprobacion = models.CharField(max_length=24, choices=Via.choices, blank=True, default='')
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_validacion = models.DateTimeField(null=True, blank=True)
    requiere_nueva_foto = models.BooleanField(default=False)

    class Meta:
        db_table = 'fe_de_vida_solicitud'
        ordering = ['-created_at']
        verbose_name = 'solicitud de fe de vida'
        verbose_name_plural = 'solicitudes de fe de vida'
        constraints = [
            models.UniqueConstraint(fields=['proceso', 'cedula'], name='fv_solicitud_proceso_cedula_uniq'),
        ]
        indexes = [models.Index(fields=['proceso', 'estado'], name='fv_sol_proceso_estado_idx')]

    def __str__(self) -> str:
        return f'FeDeVida({self.cedula}, {self.estado})'


class DecisionFeDeVidaModel(BaseModel):
    """Historial inmutable de checks, aprobaciones directas, rechazos y devoluciones."""

    class Tipo(models.TextChoices):
        CHECK = 'CHECK'
        CHECK_RETIRADO = 'CHECK_RETIRADO'
        APROBACION_DIRECTA = 'APROBACION_DIRECTA'
        RECHAZO = 'RECHAZO'
        DEVOLUCION = 'DEVOLUCION'

    class Rol(models.TextChoices):
        ANALISTA = 'ANALISTA'
        ADMINISTRADORA = 'ADMINISTRADORA'

    solicitud = models.ForeignKey(SolicitudFeDeVidaModel, on_delete=models.PROTECT, related_name='decisiones')
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    rol = models.CharField(max_length=15, choices=Rol.choices)
    actor_cedula = models.CharField(max_length=15)
    envio = models.PositiveSmallIntegerField()
    motivo = models.TextField(blank=True, default='')
    fecha = models.DateTimeField()

    class Meta:
        db_table = 'fe_de_vida_decision'
        ordering = ['fecha', 'created_at']
        verbose_name = 'decisión de fe de vida'
        verbose_name_plural = 'decisiones de fe de vida'

    def __str__(self) -> str:
        return f'{self.tipo} por {self.actor_cedula}'


class ConstanciaFeDeVidaModel(BaseModel):
    """Constancia emitida al validarse (C4 la genera; aquí solo el registro). Sin selfie ni firma digitalizada."""

    solicitud = models.OneToOneField(SolicitudFeDeVidaModel, on_delete=models.PROTECT, related_name='constancia')
    numero = models.CharField(max_length=20, unique=True)  # FV-AAAA-NNNNNN
    codigo_verificacion = models.CharField(max_length=64, unique=True)
    certificada_por = models.JSONField(default=list)  # [{'nombre':..., 'cedula':..., 'rol':...}]
    plantilla_version = models.PositiveSmallIntegerField(default=1)
    clave_pdf = models.CharField(max_length=255, blank=True, default='')
    emitida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'fe_de_vida_constancia'
        verbose_name = 'constancia de fe de vida'
        verbose_name_plural = 'constancias de fe de vida'

    def __str__(self) -> str:
        return self.numero


class PlantillaConstanciaModel(BaseModel):
    """Plantilla versionada de la constancia (RN-19/20). La v1 se siembra en la migración 0002."""

    version = models.PositiveSmallIntegerField(unique=True)
    titulo = models.CharField(max_length=160)
    texto = models.TextField()  # admite {fecha}, {nombre_completo}, {cedula}, {condicion}
    activa = models.BooleanField(default=False)

    class Meta:
        db_table = 'fe_de_vida_plantilla_constancia'
        ordering = ['-version']
        verbose_name = 'plantilla de constancia'
        verbose_name_plural = 'plantillas de constancia'

    def __str__(self) -> str:
        return f'Plantilla v{self.version}'
