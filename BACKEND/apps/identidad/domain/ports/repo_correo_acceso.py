"""Puerto del correo de acceso (`Employee.correo`, único) y del alternativo declarado (B13)."""
from typing import Protocol


class RepoCorreoAcceso(Protocol):
    def existe_empleado(self, cedula: str) -> bool: ...

    def correo_de(self, cedula: str) -> str:
        """Correo de acceso actual ('' si no tiene)."""
        ...

    def correo_alternativo_de(self, cedula: str) -> str:
        """Correo alternativo declarado por el trabajador ('' si no hay)."""
        ...

    def correo_en_uso_por_otro(self, cedula: str, correo: str) -> bool:
        """¿Otro empleado ya usa este correo? (la columna es única)."""
        ...

    def establecer_correo(self, cedula: str, correo: str) -> None: ...
