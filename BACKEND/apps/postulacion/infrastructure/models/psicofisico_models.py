"""Modelo ORM NUEVO (managed=True) del resultado del test psicofísico (D-8, C-6): resultado + informe, nada más."""
from django.db import models
from django.utils import timezone

from apps.postulacion.domain.entities.psicofisico import APTO, NO_APTO
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from core.infrastructure.models.base import BaseModel


class ResultadoPsicofisicoModel(BaseModel):
    RESULTADOS = [(APTO, 'Apto'), (NO_APTO, 'No apto')]

    expediente = models.OneToOneField(
        ExpedientePostulacionModel, on_delete=models.PROTECT, related_name='psicofisico',
    )
    resultado = models.CharField(max_length=10, choices=RESULTADOS)
    fecha_aplicacion = models.DateField()
    observaciones = models.TextField(blank=True, default='')
    # Informe PDF opcional en SeaweedFS: clave opaca (sin la cédula), huella y tamaño para comprobar que no cambió.
    informe_clave = models.CharField(max_length=200, blank=True, default='')
    informe_sha256 = models.CharField(max_length=64, blank=True, default='')
    informe_tamano = models.PositiveIntegerField(default=0)
    registrado_por = models.CharField(max_length=15, blank=True, default='')
    registrado_el = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'postulacion_resultado_psicofisico'
        verbose_name = 'resultado psicofísico'
        verbose_name_plural = 'resultados psicofísicos'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(resultado__in=[APTO, NO_APTO]), name='postul_psico_resultado_valido',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.expediente_id} {self.resultado}'
