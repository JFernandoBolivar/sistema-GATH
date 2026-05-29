import hashlib
from django.conf import settings
from django.db import models
from RAC.models import Employee


class MotivosEmision(models.Model):
    """Motivos predefinidos para emisión de carnets."""

    nombre = models.CharField(max_length=100, unique=True, verbose_name='Motivo')

    class Meta:
        managed = True
        db_table = 'MotivosEmision'
        app_label = 'CARNETIZACION'
        ordering = ['nombre']
        verbose_name = 'Motivo de emisión'
        verbose_name_plural = 'Motivos de emisión'

    def __str__(self):
        return self.nombre


class CarnetEmitido(models.Model):
    """Registro de carnets emitidos. Usa hash determinístico para validación QR."""

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='carnets_emitidos',
        db_column='employeeId'
    )
    security_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        verbose_name='Hash de seguridad'
    )
    fecha_emision = models.DateTimeField(auto_now_add=True)
    motivo = models.ForeignKey(
        MotivosEmision,
        on_delete=models.PROTECT,
        related_name='carnets',
        db_column='motivoId',
        verbose_name='Motivo de emisión'
    )
    observaciones = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = True
        db_table = 'CarnetEmitido'
        app_label = 'CARNETIZACION'
        ordering = ['-fecha_emision']
        verbose_name = 'Carnet Emitido'
        verbose_name_plural = 'Carnets Emitidos'

    def __str__(self):
        return f"Carnet #{self.id} - {self.employee.cedulaidentidad}"

    def _compute_security_hash(self):
        raw = f"{self.id}|{self.employee.cedulaidentidad}|{self.fecha_emision.isoformat()}|{settings.SECRET_KEY}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.security_hash:
            self.security_hash = self._compute_security_hash()
            super().save(update_fields=['security_hash'])


class CarnetTemplate(models.Model):
    """Plantillas de fondo para carnets. Solo una puede estar activa a la vez."""

    nombre = models.CharField(max_length=100, verbose_name='Nombre de la plantilla')
    imagen = models.ImageField(
        upload_to='carnet_templates/',
        verbose_name='Imagen de fondo'
    )
    activo = models.BooleanField(default=False, verbose_name='Plantilla activa')
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = 'CarnetTemplate'
        app_label = 'CARNETIZACION'
        ordering = ['-activo', '-creado']
        verbose_name = 'Plantilla de carnet'
        verbose_name_plural = 'Plantillas de carnet'

    def __str__(self):
        return self.nombre

    def save(self, *args, **kwargs):
        if self.activo:
            CarnetTemplate.objects.filter(activo=True).exclude(pk=self.pk).update(activo=False)
        super().save(*args, **kwargs)
