"""Clasificación y alcance del restablecimiento de acceso en bloque (U2)."""
from enum import Enum


class Clasificacion(str, Enum):
    """Qué trabajadores entran al lote según su condición."""

    ACTIVOS = 'ACTIVOS'
    PASIVOS = 'PASIVOS'
    AMBOS = 'AMBOS'


class Alcance(str, Enum):
    """Qué cuentas se tocan dentro de la clasificación."""

    VENCIDA = 'VENCIDA'  # contraseña inicial vencida (valor por defecto)
    SIN_PRIMER_INGRESO = 'SIN_PRIMER_INGRESO'  # fila de clave inicial, vigente o vencida
    TODOS = 'TODOS'
