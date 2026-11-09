"""
Modelo ORM de `ConfiguracionVisual` (HU 0009). Tabla propia, `managed=True`,
migración real nueva (no hay esquema legado involucrado). Fila única
(singleton): el repositorio siempre opera sobre la primera fila, creándola
con los valores por defecto (= comportamiento actual hardcodeado) si no
existe aún. Se re-exporta en `apps/configuracion/models.py` (regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel

NOMBRE_EMPRESA_DEFECTO = 'Comisión Nacional de Telecomunicaciones (CONATEL)'


class ConfiguracionVisualModel(BaseModel):
    class TipoCintillo(models.TextChoices):
        GENERICO = 'GENERICO'
        FIJO = 'FIJO'

    tipo_cintillo = models.CharField(
        max_length=10, choices=TipoCintillo.choices, default=TipoCintillo.FIJO,
    )
    nombre_empresa = models.CharField(max_length=200, null=True, blank=True, default=NOMBRE_EMPRESA_DEFECTO)
    # None en cualquiera de las 3 claves = usar el asset hardcodeado de
    # `core/infrastructure/pdf/assets/` correspondiente (logo01/logo02/cintillo2).
    logo_principal_clave = models.CharField(max_length=255, null=True, blank=True)
    logo_secundario_clave = models.CharField(max_length=255, null=True, blank=True)
    cintillo_pie_clave = models.CharField(max_length=255, null=True, blank=True)
    color_fondo = models.CharField(max_length=9, null=True, blank=True)  # hex, ej. #RRGGBB o #RRGGBBAA
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'configuracion_configuracion_visual'
        verbose_name = 'configuración visual'
        verbose_name_plural = 'configuración visual'

    def __str__(self) -> str:
        return f"ConfiguracionVisual({self.tipo_cintillo})"
