"""
Servicio para la asignación atómica de números correlativos de Punto de Cuenta por año.
Formato: XXXX-YYYY (ej. 0001-2026).
"""
from datetime import datetime
from django.db import transaction

from apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model import SecuenciaPuntoCuentaModel


def obtener_siguiente_correlativo(anio: int | None = None) -> tuple[int, str]:
    """
    Obtiene e incrementa atómicamente la secuencia de punto de cuenta para el año indicado.
    Retorna (secuencia, numero_formateado).
    """
    if anio is None:
        anio = datetime.now().year

    with transaction.atomic():
        secuencia_obj, _ = SecuenciaPuntoCuentaModel.objects.select_for_update().get_or_create(
            anio=anio,
            defaults={'ultimo_numero': 0},
        )
        secuencia_obj.ultimo_numero += 1
        secuencia_obj.save(update_fields=['ultimo_numero'])
        secuencia = secuencia_obj.ultimo_numero
        numero = f"{secuencia:04d}-{anio}"
        return secuencia, numero
