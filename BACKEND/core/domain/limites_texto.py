"""Límites de los campos de texto libre (direcciones, motivos, observaciones).

Paridad con `NextJS/src/shared/validation/limites-texto.ts`: cambiar ambos a la vez.
Ningún máximo supera el de la columna en la BD (los campos son TextField o 500+).
"""
from typing import Final

DIRECCION_MIN: Final = 10
DIRECCION_MAX: Final = 500
MOTIVO_MIN: Final = 10
MOTIVO_MAX: Final = 500
OBSERVACION_MIN: Final = 5
OBSERVACION_MAX: Final = 500


def mensajes_texto(nombre: str, minimo: int, maximo: int) -> dict[str, str]:
    """`error_messages` de un `CharField` DRF con textos en español por campo."""
    return {
        'required': f'{nombre} es un campo obligatorio.',
        'blank': f'{nombre} es un campo obligatorio.',
        'null': f'{nombre} es un campo obligatorio.',
        'min_length': f'{nombre} debe tener al menos {minimo} caracteres.',
        'max_length': f'{nombre} no puede superar {maximo} caracteres.',
    }
