"""Resultado de revisar cuentas activas sin vencimiento de clave inicial (S2-02).

Puro: sin Django (regla B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CuentasConClaveInicial:
    """Cuentas activas sin fila de vencimiento cuya contraseña sigue siendo la cédula.

    - `cuenta_ids`: las que hay que vencer (la clave vigente es la inicial).
    - `revisadas`: cuántas cuentas activas sin fila se miraron en total.
    """

    cuenta_ids: tuple[int, ...] = ()
    revisadas: int = 0
