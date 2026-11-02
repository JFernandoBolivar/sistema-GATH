"""Puerto de lectura de la condición (ACTIVO/PASIVO) de un trabajador por cédula."""
from typing import Protocol

from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


class RepoCondicionTrabajador(Protocol):
    def condicion_por_cedula(self, cedula: str) -> CondicionTrabajador:
        """Condición vigente del trabajador; `SIN_ASIGNACION` si no hay datos."""
        ...
