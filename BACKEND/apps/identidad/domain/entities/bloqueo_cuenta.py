"""
Entidad `BloqueoCuenta` del dominio de identidad (B3.12).

Estado del contador de intentos fallidos y del bloqueo progresivo de una
cuenta de acceso. Pura e inmutable (B1, B5): el repositorio la materializa
desde caché/BD y los casos de uso solo la consultan.
"""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class BloqueoCuenta:
    """Intentos fallidos acumulados y vencimiento del bloqueo de una cuenta."""

    cedula: str
    intentos: int = 0
    bloqueada_hasta: datetime | None = None
    motivo: str = ''

    def esta_bloqueada(self, ahora: datetime) -> bool:
        """¿El bloqueo sigue vigente en el instante `ahora`?"""
        return self.bloqueada_hasta is not None and self.bloqueada_hasta > ahora
