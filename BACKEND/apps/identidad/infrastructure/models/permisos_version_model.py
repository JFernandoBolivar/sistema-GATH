"""
Tabla propia (`managed=True`) con la versión de permisos por cuenta (Etapa A4).

`USER_cuenta` es legada y no se altera: la versión se guarda aquí, con
`cuenta_id` único. Sin fila = versión 1.
"""
from django.db import models


class PermisosVersionModel(models.Model):
    cuenta_id = models.IntegerField(unique=True)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'identidad_cuenta_permisos_version'
        verbose_name = 'versión de permisos de cuenta'
        verbose_name_plural = 'versiones de permisos de cuenta'

    def __str__(self) -> str:
        return f'Cuenta {self.cuenta_id} v{self.version}'
