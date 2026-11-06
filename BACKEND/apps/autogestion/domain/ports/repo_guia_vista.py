"""
Puerto de repositorio para el seguimiento de guías interactivas vistas (O35).
"""
from abc import ABC, abstractmethod
from apps.autogestion.domain.entities.guia_vista import GuiaVista


class RepoGuiaVista(ABC):
    @abstractmethod
    def listar_vistas_por_cedula(self, cedula: str) -> list[GuiaVista]:
        """Devuelve todas las guías registradas como vistas por el usuario."""
        pass

    @abstractmethod
    def ha_visto_guia(self, cedula: str, guia_id: str, version: int) -> bool:
        """Indica si el usuario ya vio la versión indicada o superior de la guía."""
        pass

    @abstractmethod
    def registrar_vista(self, cedula: str, guia_id: str, version: int) -> GuiaVista:
        """Registra de forma idempotente que el usuario completó/cerró la guía."""
        pass
