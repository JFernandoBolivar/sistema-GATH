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


class ConsultorCargas(Protocol):
    """Lectura de cargas para las vistas (S5-01): el ORM no vive en `presentation`."""

    def obtener_visible(self, carga_id: str, cedula: str, puede_aprobar: bool): ...

    def listar(
        self, cedula: str, puede_aprobar: bool, poblaciones: list[str],
        poblacion: str | None = None, estado: str | None = None,
    ) -> list: ...

    def resumen(self, carga) -> dict: ...

    def filas(
        self, carga, estado: str | None = None, solo_confirmacion: bool = False,
    ) -> list[dict]: ...


class CreadorCarga(Protocol):
    """Alta de una carga y marca de error (S5-01: sin ORM en la vista)."""

    def crear(
        self, *, archivo_nombre: str, tamano_bytes: int, tipos: list[str], modo: str,
        poblacion: str, solicitada_por_cedula: str,
    ): ...

    def marcar_error(self, carga) -> None: ...


class ExportadorResultadosCarga(Protocol):
    def generar_bytes(self, carga) -> bytes: ...
