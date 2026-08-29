"""
Modelo ORM de incidentes de bloqueo de cuentas (B3.12).

Registro append-only de los incidentes de seguridad del login: cada fila
documenta un evento sobre una cuenta (hoy, 'bloqueo_aplicado'). Alimenta la
ventana de progresión del bloqueo y la consulta forense. Se re-exporta en
`apps/identidad/models.py` (regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class IntentoFallidoModel(BaseModel):
    """Incidente de seguridad sobre una cuenta durante el login (B3.12)."""

    class Resultado(models.TextChoices):
        BLOQUEO_APLICADO = 'bloqueo_aplicado'

    # Cédula de identidad venezolana (máximo 10 caracteres)
    cedula = models.CharField(max_length=10, db_index=True)


    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    resultado = models.CharField(
        max_length=30,
        choices=Resultado.choices,
        default=Resultado.BLOQUEO_APLICADO,
    )

    class Meta:
        db_table = 'identidad_intento_fallido'
        ordering = ['-fecha_hora']
        verbose_name = 'intento fallido'
        verbose_name_plural = 'intentos fallidos'

    def __str__(self) -> str:
        return f'{self.cedula} · {self.resultado} · {self.fecha_hora:%Y-%m-%d %H:%M}'
