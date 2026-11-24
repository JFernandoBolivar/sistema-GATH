"""Modelos ORM de los documentos digitales (F-1, regla B26)."""
from django.db import models

from core.infrastructure.models.base import BaseModel


class PlantillaDocumentoModel(BaseModel):
    """Plantilla en edición (borrador de trabajo) + metadatos. Cada publicación crea una versión inmutable."""

    MODOS = [('formulario', 'Formulario propio'), ('pdf_overlay', 'Formato de terceros (PDF de fondo)')]
    MOMENTOS = [('ventana2', 'Ventana 2'), ('contratacion', 'Contratación'), ('otro', 'Otro')]
    FIRMANTES = [('postulante', 'Postulante'), ('conatel', 'CONATEL'), ('ambos', 'Ambos')]

    codigo = models.CharField(max_length=60, unique=True)
    nombre = models.CharField(max_length=160)
    descripcion = models.CharField(max_length=400, blank=True, default='')
    modo = models.CharField(max_length=16, choices=MODOS)
    momento = models.CharField(max_length=16, choices=MOMENTOS, default='otro')
    firmante = models.CharField(max_length=16, choices=FIRMANTES, default='postulante')
    requiere_firma_clic = models.BooleanField(default=False)
    activa = models.BooleanField(default=False)
    ultima_version = models.PositiveIntegerField(default=0)
    definicion = models.JSONField(default=dict)
    campos_propios = models.JSONField(default=list)
    fondo_clave = models.CharField(max_length=200, blank=True, default='')
    fondo_sha256 = models.CharField(max_length=64, blank=True, default='')
    fondo_nombre = models.CharField(max_length=200, blank=True, default='')
    fondo_paginas = models.JSONField(default=list)
    creado_por_id = models.IntegerField(null=True, blank=True)
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'documentos_plantilla'
        ordering = ['nombre']
        verbose_name = 'plantilla de documento'
        verbose_name_plural = 'plantillas de documento'

    def __str__(self) -> str:
        return f'{self.codigo} ({self.modo})'


class VersionPlantillaDocumentoModel(BaseModel):
    """Versión publicada: inmutable (no se puede modificar ni borrar una vez creada)."""

    plantilla = models.ForeignKey(PlantillaDocumentoModel, on_delete=models.PROTECT, related_name='versiones')
    numero = models.PositiveIntegerField()
    modo = models.CharField(max_length=16)
    definicion = models.JSONField()
    campos_propios = models.JSONField(default=list)
    fondo_clave = models.CharField(max_length=200, blank=True, default='')
    fondo_sha256 = models.CharField(max_length=64, blank=True, default='')
    fondo_paginas = models.JSONField(default=list)
    metadatos = models.JSONField(default=dict)
    definicion_sha256 = models.CharField(max_length=64)
    publicada_por_id = models.IntegerField(null=True, blank=True)
    publicada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'documentos_plantilla_version'
        ordering = ['-numero']
        constraints = [models.UniqueConstraint(fields=['plantilla', 'numero'], name='uq_documentos_version_numero')]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError('Una versión publicada de una plantilla es inmutable.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError('Una versión publicada de una plantilla no se puede borrar.')


class DocumentoGeneradoModel(BaseModel):
    """PDF generado a partir de una versión. El sujeto se referencia por id, sin FK a otra app."""

    plantilla = models.ForeignKey(PlantillaDocumentoModel, on_delete=models.PROTECT, related_name='generados')
    version = models.ForeignKey(VersionPlantillaDocumentoModel, on_delete=models.PROTECT, related_name='generados')
    sujeto_tipo = models.CharField(max_length=40)
    sujeto_id = models.CharField(max_length=64)
    datos_snapshot = models.JSONField(default=dict)
    pdf_clave = models.CharField(max_length=200)
    pdf_sha256 = models.CharField(max_length=64)
    generado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'documentos_generado'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['sujeto_tipo', 'sujeto_id'], name='ix_documentos_gen_sujeto')]


class FirmaDocumentoModel(BaseModel):
    """Evidencia de la firma por clic de conformidad."""

    documento = models.ForeignKey(DocumentoGeneradoModel, on_delete=models.PROTECT, related_name='firmas')
    firmante_tipo = models.CharField(max_length=16)
    firmante_id = models.CharField(max_length=64)
    firmado_en = models.DateTimeField()
    ip = models.CharField(max_length=64, blank=True, default='')
    user_agent = models.CharField(max_length=400, blank=True, default='')
    sha256_firmado = models.CharField(max_length=64)
    texto_conformidad = models.TextField()

    class Meta:
        db_table = 'documentos_firma'
        ordering = ['firmado_en']
        constraints = [models.UniqueConstraint(
            fields=['documento', 'firmante_tipo', 'firmante_id'], name='uq_documentos_firma_firmante')]
