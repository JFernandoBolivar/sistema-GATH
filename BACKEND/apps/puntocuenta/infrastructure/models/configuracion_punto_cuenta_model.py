"""Modelos ORM de configuración y secuencia de Punto de Cuenta (Regla B26)."""
from django.db import models

from core.infrastructure.models.base import BaseModel
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import PROCESOS_POR_DEFECTO


def _defecto_procesos():
    return dict(PROCESOS_POR_DEFECTO)


def _defecto_firmas():
    """Solo lo referencia la migración 0004 (el campo `firmas` se retiró en la 0008): no borrar."""
    return [{'cargo': 'Director(a) General de Gestión Humana', 'nombre': ''}]


class ConfiguracionPuntoCuentaModel(BaseModel):
    """Configuración operativa de los procesos que emiten Puntos de Cuenta.

    El contenido visual y las firmas se editan y publican en el diseñador de
    documentos; aquí no se guardan textos ni versiones de plantilla.
    """

    procesos_habilitados = models.JSONField(default=_defecto_procesos)
    version = models.IntegerField(default=1)
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'puntocuenta_configuracion'
        ordering = ['-version']
        verbose_name = 'configuración de punto de cuenta'
        verbose_name_plural = 'configuraciones de punto de cuenta'

    def __str__(self) -> str:
        return 'ConfiguracionPuntoCuenta'


class RespaldoConfiguracionPuntoCuentaModel(models.Model):
    """Respaldo migratorio de los textos retirados; no se administra desde la API."""

    configuracion_id = models.UUIDField(primary_key=True, serialize=False)
    datos = models.JSONField(default=dict)

    class Meta:
        managed = False
        db_table = 'puntocuenta_configuracion_respaldo'
        verbose_name = 'respaldo migratorio de configuración de punto de cuenta'
        verbose_name_plural = 'respaldos migratorios de configuración de punto de cuenta'


class SecuenciaPuntoCuentaModel(models.Model):
    """Contador atómico de correlativo anual de puntos de cuenta (N.º XXXX-YYYY)."""

    anio = models.IntegerField(primary_key=True)
    ultimo_numero = models.IntegerField(default=0)

    class Meta:
        db_table = 'puntocuenta_secuencia'
        verbose_name = 'secuencia de punto de cuenta'
        verbose_name_plural = 'secuencias de puntos de cuenta'

    def __str__(self) -> str:
        return f"Secuencia {self.anio}: {self.ultimo_numero}"
