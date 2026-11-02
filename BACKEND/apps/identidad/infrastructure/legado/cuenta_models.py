"""
Modelo espejo solo-lectura de la cuenta legada (B3.1, regla R7).

Permite al repositorio de identidad resolver cédula → rol **sin importar la
app USER** (regla B16): apunta por `db_table` a la misma tabla física
(`user_cuenta`, nomenclatura por defecto de Django para `USER.cuenta`) con
solo las columnas que este módulo necesita. `managed=False`: la dueña de la
tabla es la app legada; aquí nunca se crea ni se escribe.
"""
from django.db import models


class CuentaEspejo(models.Model):
    """Espejo de lectura de `USER.cuenta` (id, cédula y rol únicamente)."""

    id = models.IntegerField(primary_key=True)
    # Columna `cedula`: valor de `RAC.Employee.cedulaidentidad` (TextField).
    cedula = models.TextField()
    rol_id = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'USER_cuenta'
        verbose_name = 'cuenta (espejo legado)'
        verbose_name_plural = 'cuentas (espejo legado)'

    def __str__(self) -> str:
        return self.cedula


class RolEspejo(models.Model):
    """
    Espejo de lectura de `USER.Rol` (solo PK y etiqueta). Sirve el nombre
    real del rol al agregado de dominio; la matriz vive en tablas propias.
    """

    id = models.IntegerField(primary_key=True)
    nombre_rol = models.TextField()

    class Meta:
        managed = False
        db_table = 'USER_rol'
        verbose_name = 'rol (espejo legado)'
        verbose_name_plural = 'roles (espejo legado)'

    def __str__(self) -> str:
        return self.nombre_rol
