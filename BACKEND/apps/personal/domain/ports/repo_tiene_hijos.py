"""
Puerto del dato «¿tiene hijos?» del trabajador (vive en los datos complementarios de autogestión).
"""
from typing import Protocol


class RepoTieneHijos(Protocol):
    def existe_trabajador(self, cedula: str) -> bool:
        ...

    def obtener(self, cedula: str) -> bool | None:
        """True / False, o None si el trabajador aún no declaró el dato."""
        ...

    def guardar(self, cedula: str, valor: bool | None, actor_cedula: str) -> bool | None:
        ...
