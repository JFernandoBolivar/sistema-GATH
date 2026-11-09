"""
Modelo ORM para persistencia de guías interactivas vistas por cuenta (O35).
"""
from django.db import models
from core.infrastructure.models.base import BaseModel


class GuiaVistaModel(BaseModel):
    """
    Registra que un usuario (por cédula de cuenta) vio o cerró a propósito
    una versión específica de una guía interactiva.
    """

    cedula = models.CharField(max_length=15, db_index=True)
    guia_id = models.CharField(max_length=64, db_index=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "autogestion_guia_vista"
        verbose_name = "guía interactiva vista"
        verbose_name_plural = "guías interactivas vistas"
        constraints = [
            models.UniqueConstraint(
                fields=["cedula", "guia_id", "version"],
                name="ag_guia_vista_cedula_guia_ver_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.cedula} - {self.guia_id} (v{self.version})"
