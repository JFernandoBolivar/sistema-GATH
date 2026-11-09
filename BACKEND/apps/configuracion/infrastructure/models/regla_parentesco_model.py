"""Reglas configurables del catálogo de parentescos (FIX-FAM2).

Tabla propia `managed=True`; el parentesco sigue viviendo en `RAC_parentesco`
(tabla legada `managed=False`). La relación es por `parentesco_id` entero para
no crear una FK contra una tabla no gestionada.
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class ReglaParentescoModel(BaseModel):
    class DiferenciaTipo(models.TextChoices):
        NINGUNA = 'NINGUNA'
        MENOR = 'MENOR'
        MAYOR = 'MAYOR'

    parentesco_id = models.PositiveIntegerField(unique=True, db_index=True)
    # Marca del catálogo: puede usar la cédula sintética del titular.
    es_hijo = models.BooleanField(default=False)
    menor_a_cargo = models.BooleanField(default=False)
    # Edad máxima para generar cédula correlativa (hijo/tutelado). NULL = no aplica.
    sin_cedula_hasta_edad = models.PositiveSmallIntegerField(null=True, blank=True)
    edad_minima = models.PositiveSmallIntegerField(null=True, blank=True)
    diferencia_minima = models.PositiveSmallIntegerField(null=True, blank=True)
    diferencia_tipo = models.CharField(
        max_length=8, choices=DiferenciaTipo.choices, default=DiferenciaTipo.NINGUNA,
    )
    # 'M' / 'F' / vacío (cualquiera).
    sexo_permitido = models.CharField(max_length=1, blank=True, default='')
    soporte_sugerido = models.CharField(max_length=120, blank=True, default='')
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'configuracion_regla_parentesco'
        ordering = ['parentesco_id']
        verbose_name = 'regla de parentesco'
        verbose_name_plural = 'reglas de parentesco'

    def __str__(self) -> str:
        return f'regla parentesco {self.parentesco_id}'
