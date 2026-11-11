"""
Estatus previo de los cargos que suspendio un prestamo de cargo (L2-06).

Tabla propia del modulo (managed): al finalizar el prestamo se restaura solo
lo que el prestamo suspendio, y su existencia indica que el prestamo ya
suspendio sus cargos. Referencias por id (sin FK a tablas legadas).
"""
from django.db import models


class PrestamoCargoSuspensionModel(models.Model):
    prestamo_id = models.IntegerField(db_index=True)
    asig_trabajo_id = models.IntegerField()
    estatus_previo_id = models.IntegerField()
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cargos_prestamo_suspension'
        constraints = [
            models.UniqueConstraint(
                fields=['prestamo_id', 'asig_trabajo_id'], name='uniq_prestamo_suspension_cargo'
            ),
        ]
