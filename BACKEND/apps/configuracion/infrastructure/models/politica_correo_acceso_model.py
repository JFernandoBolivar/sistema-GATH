"""
Modelos ORM para la política de Correo de Acceso y registro de Excepciones Manuales (A7).
Tablas propias con managed=True.
"""
from django.db import models

from core.infrastructure.models.base import BaseModel


class PoliticaCorreoAccesoModel(BaseModel):
    """
    Configuración global de la política de resolución de correo de acceso para cuentas.
    Tabla propia singleton: suele existir un único registro activo.
    """
    CHOICES_FUENTE = [
        ('alternativo', 'Alternativo'),
        ('institucional', 'Institucional'),
        ('correo_ficha', 'Correo de la ficha'),
    ]
    CHOICES_FALTA = [
        ('dejar_sin_cuenta', 'Dejar sin cuenta hasta que se cargue'),
        ('usar_siguiente', 'Usar el siguiente disponible'),
    ]

    politica_pasivos = models.CharField(
        max_length=20,
        choices=CHOICES_FUENTE,
        default='alternativo',
        help_text='Fuente primaria de correo para pasivos y sobrevivientes.',
    )
    politica_activos = models.CharField(
        max_length=20,
        choices=CHOICES_FUENTE,
        default='institucional',
        help_text='Fuente primaria de correo para personal activo.',
    )
    si_falta_elegido = models.CharField(
        max_length=20,
        choices=CHOICES_FALTA,
        default='dejar_sin_cuenta',
        help_text='Comportamiento cuando el correo de la fuente elegida no está cargado.',
    )
    avisar_al_aplicar_masivo = models.BooleanField(
        default=False,
        help_text='Si está activo, notifica por correo al aplicar masivamente los cambios.',
    )
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'configuracion_politica_correo_acceso'
        verbose_name = 'política de correo de acceso'
        verbose_name_plural = 'políticas de correo de acceso'

    def __str__(self) -> str:
        return f'PoliticaCorreoAcceso(pasivos={self.politica_pasivos}, activos={self.politica_activos})'


class ExcepcionCorreoAccesoModel(BaseModel):
    """
    Registra cuentas que han sido configuradas manualmente desde la tarjeta individual
    para que la aplicación masiva no las sobrescriba (salvo indicación explícita).
    """
    cedula = models.CharField(max_length=20, unique=True, db_index=True)
    motivo = models.TextField(blank=True, default='')
    actor_cedula = models.CharField(max_length=20, blank=True, default='')

    class Meta:
        db_table = 'configuracion_excepcion_correo_acceso'
        verbose_name = 'excepción manual de correo de acceso'
        verbose_name_plural = 'excepciones manuales de correo de acceso'

    def __str__(self) -> str:
        return f'Excepcion(cedula={self.cedula})'
