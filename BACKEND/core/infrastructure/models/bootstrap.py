"""Estado de las tareas de preparación de una base (bootstrap idempotente)."""
from django.db import models


class BootstrapStateModel(models.Model):
    """Marca qué preparaciones de datos ya se aplicaron en esta base.

    Se usa para que `preparar_produccion` ejecute `seed_permisos`, el mapeo de
    roles y la sincronización de cuentas una sola vez por base, sin depender de
    un comando manual ni de variables de entorno.
    """

    clave = models.CharField(max_length=100, primary_key=True)
    aplicado_en = models.DateTimeField(auto_now_add=True)
    detalle = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'core_bootstrap_state'
        verbose_name = 'estado de bootstrap'
        verbose_name_plural = 'estados de bootstrap'

    def __str__(self) -> str:
        return f'{self.clave} ({self.aplicado_en:%Y-%m-%d %H:%M})'
