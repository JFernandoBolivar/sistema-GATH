from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from apps.notificaciones.domain.entities.notificacion import Notificacion


@dataclass(frozen=True)
class FiltroNotificaciones:
    """`modulo` opcional: vacío/None = todas las notificaciones del usuario (bandeja única). Fechas: días inclusivos."""

    modulo: str | None = None
    q: str = ''
    tipo: str = ''
    leida: bool | None = None
    desde: date | None = None
    hasta: date | None = None


@dataclass(frozen=True)
class EstadoBandeja:
    """Huella barata de la bandeja del usuario: cambia si llega, se lee o se atiende un aviso."""

    no_leidas: int
    total: int
    ultima_actualizacion: datetime | None


class RepoNotificaciones(Protocol):
    def crear_muchas(self, notificaciones: list[Notificacion]) -> int:
        """Inserta ignorando las que ya existen por (destinatario, clave_unica). Devuelve cuántas se crearon."""
        ...

    def listar(
        self, cedula: str, filtro: FiltroNotificaciones, limite: int, desplazamiento: int,
    ) -> tuple[list[Notificacion], int]: ...

    def contar_no_leidas(self, cedula: str, modulo: str | None = None) -> int: ...

    def estado(self, cedula: str) -> EstadoBandeja:
        """Una sola consulta agregada sobre las notificaciones del destinatario."""
        ...

    def marcar_leida(self, cedula: str, notificacion_id: str, ahora) -> bool:
        """True si la notificación existe y es del destinatario (aunque ya estuviera leída); False si no."""
        ...

    def resolver_avisos(
        self, ref_tipo: str, ref_id: str, tipo: str | None, por_cedula: str, por_nombre: str, ahora,
    ) -> list[str]:
        """Marca atendidas (y leídas) las copias PENDIENTES del caso. Devuelve la cédula destinataria de cada copia marcada (idempotente: vacío si ya estaban atendidas)."""
        ...

    def marcar_todas_leidas(self, cedula: str, modulo: str | None, ahora) -> int: ...
