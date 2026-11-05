"""
Modelos ORM de configuración y secuencia de Punto de Cuenta (Regla B26).
"""
from django.db import models

from core.infrastructure.models.base import BaseModel

PROCESOS_POR_DEFECTO = {
    'cambio_oficina': True,  # RN-006-01: activado por defecto
    'cambio_nivel': False,
    'cambio_division': False,
    'cambio_cargo_misma_oficina': False,
    'egreso_activo': False,
    'pase_a_pasivo': False,
    'encargaduria_prestamo': False,
    'cambio_estatus': False,
}

FIRMAS_POR_DEFECTO = [
    {
        'cargo': 'Director(a) General de Gestión Humana',
        'nombre': '',
    }
]

TITULO_POR_DEFECTO = 'PUNTO DE CUENTA'
ENCABEZADO_POR_DEFECTO = 'Para su conocimiento y fines pertinentes, se notifica el siguiente movimiento de personal:'
CUERPO_POR_DEFECTO = (
    'Por medio del presente punto de cuenta, se deja constancia del movimiento del funcionario '
    '{nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}. '
    'Movimiento desde {origen} hacia {destino}, con fecha {fecha} y motivo {motivo}, '
    'bajo el Punto de Cuenta N.º {numero}.'
)


def _defecto_procesos():
    return dict(PROCESOS_POR_DEFECTO)


def _defecto_firmas():
    return list(FIRMAS_POR_DEFECTO)


class ConfiguracionPuntoCuentaModel(BaseModel):
    """
    Configuración configurable para la generación de puntos de cuenta y su formato PDF.
    Guarda histórico incrementando la versión en cada modificación.
    """
    procesos_habilitados = models.JSONField(default=_defecto_procesos)
    titulo = models.CharField(max_length=200, default=TITULO_POR_DEFECTO)
    encabezado = models.TextField(blank=True, default=ENCABEZADO_POR_DEFECTO)
    cuerpo = models.TextField(blank=True, default=CUERPO_POR_DEFECTO)
    firmas = models.JSONField(default=_defecto_firmas)
    mostrar_nivel = models.BooleanField(default=True)
    version = models.IntegerField(default=1)
    actualizado_por_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'puntocuenta_configuracion'
        ordering = ['-version']
        verbose_name = 'configuración de punto de cuenta'
        verbose_name_plural = 'configuraciones de punto de cuenta'

    def __str__(self) -> str:
        return f"ConfiguracionPuntoCuenta(v{self.version})"


class SecuenciaPuntoCuentaModel(models.Model):
    """
    Contador atómico de correlativo anual de puntos de cuenta (N.º XXXX-YYYY).
    """
    anio = models.IntegerField(primary_key=True)
    ultimo_numero = models.IntegerField(default=0)

    class Meta:
        db_table = 'puntocuenta_secuencia'
        verbose_name = 'secuencia de punto de cuenta'
        verbose_name_plural = 'secuencias de puntos de cuenta'

    def __str__(self) -> str:
        return f"Secuencia {self.anio}: {self.ultimo_numero}"
