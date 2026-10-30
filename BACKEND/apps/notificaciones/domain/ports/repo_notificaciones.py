from dataclasses import dataclass
from datetime import date
from typing import Protocol

from apps.notificaciones.domain.entities.notificacion import Notificacion


@dataclass(frozen=True)
class FiltroNotificaciones:
    """`modulo` es obligatorio (bandeja); el resto son opcionales (None/'' = sin filtrar). Fechas: días inclusivos."""

    modulo: str
    q: str = ''
    tipo: str = ''
    leida: bool | None = None
    desde: date | None = None
    hasta: date | None = None


class RepoNotificaciones(Protocol):
    def crear_muchas(self, notificaciones: list[Notificacion]) -> int:
        """Inserta ignorando las que ya existen por (destinatario, clave_unica). Devuelve cuántas se crearon."""
        ...

    def listar(
        self, cedula: str, filtro: FiltroNotificaciones, limite: int, desplazamiento: int,
    ) -> tuple[list[Notificacion], int]: ...

    def contar_no_leidas(self, cedula: str, modulo: str) -> int: ...

    def marcar_leida(self, cedula: str, notificacion_id: str, ahora) -> bool:
        """True si la notificación existe y es del destinatario (aunque ya estuviera leída); False si no."""
        ...

    def marcar_todas_leidas(self, cedula: str, modulo: str, ahora) -> int: ...
