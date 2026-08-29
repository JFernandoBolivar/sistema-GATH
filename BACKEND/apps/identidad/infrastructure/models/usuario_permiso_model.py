"""
Modelo ORM `UsuarioPermisoModel` (B3.1 / PBAC híbrido AWS IAM).

Almacena las excepciones directas por usuario (allow/deny), la política
efectiva compilada y la versión de permisos para invalidación de JWT.
"""
from django.db import models
from core.infrastructure.models.base import BaseModel


class UsuarioPermisoModel(BaseModel):
    """
    Excepciones y permisos directos por usuario (Modelo PBAC / AWS IAM).
    """

    cedula = models.CharField(max_length=20, unique=True, db_index=True)
    permisos_custom = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"allow": ["identidad.crear_usuarios"], "deny": ["personal.salud_ver"]}',
    )
    permisos_efectivos = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"allow": ["personal.*", ...], "deny": [...]}',
    )
    version = models.IntegerField(default=1)

    class Meta:
        db_table = 'identidad_usuario_permiso'
        ordering = ['cedula']
        verbose_name = 'permiso de usuario'
        verbose_name_plural = 'permisos de usuario'

    def __str__(self) -> str:
        return f'Permisos({self.cedula}, v{self.version})'
