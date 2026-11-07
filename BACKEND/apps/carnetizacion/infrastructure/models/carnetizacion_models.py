"""
Modelos ORM de Carnetización (Regla B26, O44 - E3).
"""
import hashlib
from django.conf import settings
from django.db import models

from core.infrastructure.models.base import BaseModel
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage


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


class TipoCredencialModel(models.Model):
    """Catálogo de tipos de credencial (trabajador, pasivo, etc.) — O44 - E3."""
    codigo = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, default='')
    ancho_mm = models.DecimalField(max_digits=6, decimal_places=2, default=54.00)
    alto_mm = models.DecimalField(max_digits=6, decimal_places=2, default=85.60)
    orientacion = models.CharField(max_length=20, default='vertical')
    activo = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=1)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'CarnetTipoCredencial'
        ordering = ['orden', 'nombre']
        verbose_name = 'tipo de credencial'
        verbose_name_plural = 'tipos de credencial'

    def __str__(self) -> str:
        return f"{self.nombre} ({self.codigo})"


class PlantillaCarnetModel(BaseModel):
    """
    Modelo de plantilla por capas en mm, dos caras y tamaños libres (O44 - E3).
    Ciclo de vida: borrador -> publicada -> archivada.
    Historial de versiones y reactivación. Regla: solo una activa por tipo y regla.
    """
    nombre = models.CharField(max_length=150)
    tipo_credencial = models.ForeignKey(
        TipoCredencialModel,
        on_delete=models.PROTECT,
        related_name='plantillas',
        to_field='codigo',
        db_column='tipoCredencialCodigo',
    )
    ancho_mm = models.DecimalField(max_digits=6, decimal_places=2, default=54.00)
    alto_mm = models.DecimalField(max_digits=6, decimal_places=2, default=85.60)
    orientacion = models.CharField(max_length=20, default='vertical')
    regla_criterio = models.CharField(max_length=50, default='todos')
    regla_valor = models.CharField(max_length=100, default='*')
    estado = models.CharField(max_length=20, default='borrador')  # borrador, publicada, archivada
    activa = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    plantilla_raiz = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='versiones',
        db_column='plantillaRaizId',
    )
    definicion = models.JSONField(default=dict)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        db_column='creadoPorId',
    )
    descripcion = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'CarnetPlantillaMotor'
        ordering = ['-activa', '-created_at']
        verbose_name = 'plantilla de carnet (motor)'
        verbose_name_plural = 'plantillas de carnet (motor)'
        constraints = [
            models.UniqueConstraint(
                fields=['tipo_credencial', 'regla_criterio', 'regla_valor'],
                condition=models.Q(activa=True),
                name='unique_activa_por_tipo_y_regla',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.nombre} v{self.version} ({self.tipo_credencial_id}) {'[ACTIVA]' if self.activa else ''}"


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
    # Conservación inmutable de versión de plantilla emitida (O44 - E3)
    plantilla_id = models.CharField(max_length=64, null=True, blank=True)
    plantilla_version = models.PositiveIntegerField(null=True, blank=True)
    plantilla_snapshot = models.JSONField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'CarnetEmitido'
        ordering = ['-fecha_emision']
        verbose_name = 'carnet emitido'
        verbose_name_plural = 'carnets emitidos'

    def __str__(self) -> str:
        return f"Carnet #{self.id} - {self.employee_id} (v{self.plantilla_version or 'legacy'})"


class CarnetTemplateModel(models.Model):
    """Plantilla de fondo legacy (mantenida para paridad retrocompatible)."""
    nombre = models.CharField(max_length=100)
    imagen = models.ImageField(upload_to='carnet_templates/')
    activo = models.BooleanField(default=False)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'CarnetTemplate'
        ordering = ['-activo', '-creado']
        verbose_name = 'plantilla legacy'
        verbose_name_plural = 'plantillas legacy'

    def __str__(self) -> str:
        return self.nombre


class ElementoBibliotecaModel(BaseModel):
    """
    Biblioteca compartida de logos, firmas e imágenes institucionales (O44 - E4).
    """
    CATEGORIAS = [
        ('logo', 'Logo'),
        ('firma', 'Firma'),
        ('imagen', 'Imagen'),
    ]

    nombre = models.CharField(max_length=150)
    categoria = models.CharField(max_length=20, choices=CATEGORIAS, db_index=True)
    archivo_clave = models.CharField(max_length=255)
    nombre_archivo = models.CharField(max_length=255, default='')
    tamano_bytes = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=50)
    ancho_px = models.PositiveIntegerField(null=True, blank=True)
    alto_px = models.PositiveIntegerField(null=True, blank=True)
    descripcion = models.TextField(blank=True, default='')
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        db_column='creadoPorId',
    )

    class Meta:
        db_table = 'CarnetElementoBiblioteca'
        ordering = ['categoria', '-created_at']
        verbose_name = 'elemento de biblioteca'
        verbose_name_plural = 'elementos de biblioteca'

    def __str__(self) -> str:
        return f"{self.nombre} ({self.categoria})"


class CampoPersonalizadoModel(BaseModel):
    """
    Campos personalizados de credencial creados por administradores (O44 - E5).
    """
    codigo = models.SlugField(max_length=50, unique=True)
    etiqueta = models.CharField(max_length=100)
    grupo = models.CharField(max_length=50, default='personalizado')
    tipo_credencial = models.CharField(max_length=50, default='todos')
    sensible = models.BooleanField(default=False)
    descripcion = models.TextField(blank=True, default='')
    valor_ejemplo = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'CarnetCampoPersonalizado'
        ordering = ['grupo', 'etiqueta']
        verbose_name = 'campo personalizado de carnet'
        verbose_name_plural = 'campos personalizados de carnet'

    def __str__(self) -> str:
        return f"{self.etiqueta} ({self.codigo})"


class PreferenciaPrivacidadCarnetModel(BaseModel):
    """
    Preferencias de privacidad por dato para la ficha pública del QR (O44 - E9).
    Configurable por cada titular desde Autogestión.
    Niveles: PUBLICO, CON_SESION, SOLO_PERSONAL.
    """
    employee_id = models.IntegerField(unique=True, db_index=True)
    preferencias = models.JSONField(default=dict)

    class Meta:
        db_table = 'CarnetPrivacidadPreferencia'
        verbose_name = 'preferencia de privacidad de carnet'
        verbose_name_plural = 'preferencias de privacidad de carnet'

    def __str__(self) -> str:
        return f"Privacidad Titular #{self.employee_id}"


class BitacoraAccesoQrModel(BaseModel):
    """
    Bitácora de escaneos, aperturas de información médica y auditoría (O44 - E9).
    Registra cada consulta al código QR según el nivel de sesión y acción.
    """
    security_hash = models.CharField(max_length=64, db_index=True)
    carnet_id = models.IntegerField(null=True, blank=True)
    accion = models.CharField(max_length=32, db_index=True)
    usuario_id = models.IntegerField(null=True, blank=True)
    ip = models.CharField(max_length=45, default='')
    user_agent = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'CarnetBitacoraAcceso'
        ordering = ['-created_at']
        verbose_name = 'bitácora de acceso qr'
        verbose_name_plural = 'bitácora de accesos qr'

    def __str__(self) -> str:
        return f"[{self.accion}] Hash {self.security_hash[:8]} ({self.created_at})"
