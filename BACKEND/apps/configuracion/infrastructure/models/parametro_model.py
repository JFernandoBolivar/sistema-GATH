"""
Modelo ORM de los parámetros del sistema (D9). Tabla PROPIA `managed=True`, con
migración real: no hay esquema legado involucrado.

La fila guarda el valor vigente y los metadatos que exige la pantalla (etiqueta,
descripción, tipo, grupo y rango). Las definiciones de
`apps.configuracion.domain.parametros` son la fuente de verdad de esos metadatos
y del valor por defecto; el repositorio los sincroniza al listar.
"""
from django.db import models

from core.infrastructure.models.base import BaseModel

from apps.configuracion.domain.parametros import (
    GRUPO_FE_DE_VIDA,
    GRUPO_NOTIFICACIONES,
    GRUPO_PLAZOS,
    TIPO_BOOLEANO,
    TIPO_ENTERO,
    TIPO_TEXTO,
)


class ParametroSistemaModel(BaseModel):
    TIPO_CHOICES = [
        (TIPO_BOOLEANO, 'Booleano'),
        (TIPO_ENTERO, 'Entero'),
        (TIPO_TEXTO, 'Texto'),
    ]
    GRUPO_CHOICES = [
        (GRUPO_NOTIFICACIONES, 'Notificaciones'),
        (GRUPO_PLAZOS, 'Plazos'),
        (GRUPO_FE_DE_VIDA, 'Fe de vida'),
    ]

    clave = models.CharField(max_length=100, unique=True)
    etiqueta = models.CharField(max_length=150)
    descripcion = models.TextField()
    grupo = models.CharField(max_length=30, choices=GRUPO_CHOICES)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    valor = models.CharField(max_length=255)
    valor_min = models.IntegerField(null=True, blank=True)
    valor_max = models.IntegerField(null=True, blank=True)
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'configuracion_parametro_sistema'
        ordering = ['grupo', 'clave']
        verbose_name = 'parámetro del sistema'
        verbose_name_plural = 'parámetros del sistema'
        indexes = [models.Index(fields=['grupo', 'clave'])]

    def __str__(self) -> str:
        return f'{self.clave}={self.valor}'
