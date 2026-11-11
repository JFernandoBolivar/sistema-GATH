"""
Modelos ORM de configuración y secuencia de Punto de Cuenta (Regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel

# Los valores por defecto son dominio: `application` los usa sin importar el ORM.
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import (  # noqa: F401 (reexport)
    CUERPO_POR_DEFECTO,
    ENCABEZADO_POR_DEFECTO,
    FIRMAS_POR_DEFECTO,
    PROCESOS_POR_DEFECTO,
    TITULO_POR_DEFECTO,
)


def _defecto_procesos():
    return dict(PROCESOS_POR_DEFECTO)


def _defecto_firmas():
    return list(FIRMAS_POR_DEFECTO)


class ConfiguracionPuntoCuentaModel(BaseModel):
    """
    Configuración configurable para la generación de puntos de cuenta y su formato PDF.
    Guarda histórico incrementando la versión en cada modificación.
    """
    procesos_habilitados = models.JSONField(default=_defecto_procesos)
    titulo = models.CharField(max_length=200, default=TITULO_POR_DEFECTO)
    encabezado = models.TextField(blank=True, default=ENCABEZADO_POR_DEFECTO)
    cuerpo = models.TextField(blank=True, default=CUERPO_POR_DEFECTO)
    firmas = models.JSONField(default=_defecto_firmas)
    mostrar_nivel = models.BooleanField(default=True)
    plantillas_procesos = models.JSONField(default=dict, blank=True)
    version = models.IntegerField(default=1)
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'puntocuenta_configuracion'
        ordering = ['-version']
        verbose_name = 'configuración de punto de cuenta'
        verbose_name_plural = 'configuraciones de punto de cuenta'

    def __str__(self) -> str:
        return f"ConfiguracionPuntoCuenta(v{self.version})"


class SecuenciaPuntoCuentaModel(models.Model):
    """
    Contador atómico de correlativo anual de puntos de cuenta (N.º XXXX-YYYY).
    """
    anio = models.IntegerField(primary_key=True)
    ultimo_numero = models.IntegerField(default=0)

    class Meta:
        db_table = 'puntocuenta_secuencia'
        verbose_name = 'secuencia de punto de cuenta'
        verbose_name_plural = 'secuencias de puntos de cuenta'

    def __str__(self) -> str:
        return f"Secuencia {self.anio}: {self.ultimo_numero}"
