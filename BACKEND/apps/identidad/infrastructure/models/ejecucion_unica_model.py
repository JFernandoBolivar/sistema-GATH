"""
Marca persistente de tareas de despliegue que deben ejecutarse una sola vez (S2-02).

Tabla propia (`managed=True`): el arranque encola la tarea y, cuando termina bien,
deja aquí la constancia. Si el proceso muere antes, no hay fila y el siguiente
arranque lo reintenta.
"""
from django.db import models
from django.utils import timezone


class EjecucionUnicaModel(models.Model):
    clave = models.CharField(max_length=120, unique=True)
    ejecutada_en = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'identidad_ejecucion_unica'
        verbose_name = 'ejecución única'
        verbose_name_plural = 'ejecuciones únicas'

    def __str__(self) -> str:
        return f'{self.clave} @ {self.ejecutada_en:%Y-%m-%d %H:%M}'
