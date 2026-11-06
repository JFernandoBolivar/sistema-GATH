"""Puerto de lectura del estado de fe de vida para los reportes.

Evita que `repo_reportes_orm` importe directamente la infraestructura de
fe_de_vida: la implementación ORM vive en un adaptador de reportes.
"""
from typing import Protocol


class LectorFeDeVida(Protocol):
    def estado_por_cedula(self, cedulas: list[str]) -> dict[str, str]:
        """Estado de la solicitud del proceso ABIERTO por cédula (la más reciente)."""
        ...
