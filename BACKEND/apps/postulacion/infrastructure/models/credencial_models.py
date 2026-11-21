"""Modelo ORM de la credencial del postulante (D-3). Una fila por expediente; la contraseña solo existe como hash."""
from django.db import models
from django.utils import timezone

from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from core.infrastructure.models.base import BaseModel


class CredencialPostulanteModel(BaseModel):
    expediente = models.OneToOneField(
        ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='credencial',
    )
    usuario = models.CharField(max_length=15, db_index=True)  # la cédula del postulante
    clave_hash = models.CharField(max_length=255)  # hash del hasher de Django: nunca texto en claro
    ventana = models.PositiveSmallIntegerField(default=1)
    vence_el = models.DateTimeField(db_index=True)
    debe_cambiar_clave = models.BooleanField(default=True)
    intentos_fallidos = models.PositiveSmallIntegerField(default=0)
    bloqueada_hasta = models.DateTimeField(null=True, blank=True)
    ultimo_acceso = models.DateTimeField(null=True, blank=True)
    emitida_por = models.CharField(max_length=15, blank=True, default='')  # cédula del analista de Captación
    emitida_el = models.DateTimeField(default=timezone.now)
    version_sesion = models.PositiveIntegerField(default=1)
    revocada = models.BooleanField(default=False)

    class Meta:
        db_table = 'postulacion_credencial'
        verbose_name = 'credencial de postulante'
        verbose_name_plural = 'credenciales de postulantes'

    def __str__(self) -> str:
        return f'{self.usuario} (ventana {self.ventana})'
