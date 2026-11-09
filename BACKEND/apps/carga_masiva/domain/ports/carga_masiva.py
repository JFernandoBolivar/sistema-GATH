"""Puertos de la carga masiva: análisis y aplicación desacoplados de Django."""
from typing import Protocol


class AnalizadorCarga(Protocol):
    def analizar(self, carga, contenido: bytes, tipos: list[str]): ...


class AplicadorCarga(Protocol):
    def aplicar(self, carga, actor_cedula: str, actor_id: int | None = None): ...

    def aprobar(self, carga, actor_cedula: str, actor_id: int | None = None): ...

    def rechazar(self, carga, actor_cedula: str, motivo: str): ...

    def confirmar(
        self, carga, fila_ids: list[str], actor_cedula: str, actor_id: int | None = None,
    ): ...

    def revertir(self, carga, actor_id: int | None = None): ...
