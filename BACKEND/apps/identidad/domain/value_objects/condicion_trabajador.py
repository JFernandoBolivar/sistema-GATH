"""Condición del trabajador: dato derivado de su asignación laboral (no es un rol ni un permiso)."""
from enum import Enum


class CondicionTrabajador(str, Enum):
    ACTIVO = "ACTIVO"
    PASIVO = "PASIVO"
    SIN_ASIGNACION = "SIN_ASIGNACION"
