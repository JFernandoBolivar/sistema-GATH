"""Puerto de la marca «cuenta desactivada por egreso» (distingue la baja automática de la manual)."""
from typing import Protocol


class RepoDesactivacionEgreso(Protocol):
    def marcar(self, cuenta_id: int, motivo: str) -> None: ...

    def existe(self, cuenta_id: int) -> bool: ...

    def limpiar(self, cuenta_id: int) -> None: ...
