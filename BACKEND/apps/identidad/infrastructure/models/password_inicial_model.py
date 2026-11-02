"""
Tabla propia (`managed=True`) con el vencimiento de la contraseña inicial (decisión F, D8).

`USER_cuenta` es legada y no se altera. Hay una fila por cuenta mientras su contraseña vigente es la
inicial (la cédula): al cambiarla se borra. Sin fila = la contraseña no es una inicial emitida por el
sistema (cuentas anteriores), que no vence.
"""
from django.db import models


class PasswordInicialModel(models.Model):
    cuenta_id = models.IntegerField(unique=True)
    emitida_en = models.DateTimeField()
    vence_en = models.DateTimeField()

    class Meta:
        db_table = 'identidad_cuenta_password_inicial'
        verbose_name = 'contraseña inicial de cuenta'
        verbose_name_plural = 'contraseñas iniciales de cuentas'

    def __str__(self) -> str:
        return f'Cuenta {self.cuenta_id} vence {self.vence_en:%Y-%m-%d}'
