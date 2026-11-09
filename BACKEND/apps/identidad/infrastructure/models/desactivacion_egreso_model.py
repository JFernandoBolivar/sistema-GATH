"""
Tabla propia (`managed=True`): cuentas desactivadas AUTOMÁTICAMENTE por un egreso (D8).

Distingue la desactivación por egreso de la que hace un administrador a mano: solo la primera se
revierte sola en un reingreso. `USER_cuenta` es legada y no se altera.
"""
from django.db import models


class DesactivacionEgresoModel(models.Model):
    cuenta_id = models.IntegerField(unique=True)
    desactivada_en = models.DateTimeField(auto_now_add=True)
    motivo = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table = 'identidad_cuenta_desactivacion_egreso'
        verbose_name = 'desactivación de cuenta por egreso'
        verbose_name_plural = 'desactivaciones de cuenta por egreso'
