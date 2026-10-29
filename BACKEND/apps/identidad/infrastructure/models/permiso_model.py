"""
Modelos ORM del módulo identidad (B3.1).

Tablas nuevas `managed=True` que materializan el catálogo de permisos y su
matriz con los roles. Se re-exportan en `apps/identidad/models.py` (regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class PermisoModel(BaseModel):
    """Catálogo de permisos `[modulo].[accion]` (~80 códigos en B9)."""

    codigo = models.CharField(max_length=100, unique=True)
    nombre = models.CharField(max_length=200)

    class Meta:
        db_table = 'identidad_permiso'
        ordering = ['codigo']
        verbose_name = 'permiso'
        verbose_name_plural = 'permisos'

    def __str__(self) -> str:
        return self.codigo


class RolPermisoModel(BaseModel):
    """
    Fila de la matriz rol → permiso.

    `rol_id` guarda la PK del rol legado (`USER.Rol`) como entero simple: una
    FK real obligaría a importar la app legada, prohibido por B16. La
    migración de roles a permisología granular es B9.
    """

    # Sin db_index: uq_rol_permiso (rol_id, permiso) ya indexa por `rol_id` (prefijo).
    rol_id = models.IntegerField()
    permiso = models.ForeignKey(
        PermisoModel,
        on_delete=models.PROTECT,
        related_name='asignaciones',
    )

    class Meta:
        db_table = 'identidad_rol_permiso'
        ordering = ['rol_id', 'permiso__codigo']
        constraints = [
            models.UniqueConstraint(
                fields=['rol_id', 'permiso'], name='uq_rol_permiso'
            )
        ]
        verbose_name = 'permiso de rol'
        verbose_name_plural = 'permisos de rol'

    def __str__(self) -> str:
        return f'rol {self.rol_id} → {self.permiso.codigo}'
