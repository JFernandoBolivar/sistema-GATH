from datetime import datetime
from typing import Protocol

from apps.notificaciones.domain.entities.mensaje_outbox import MensajeOutbox
from apps.notificaciones.domain.value_objects.estado_outbox import EstadoOutbox


class RepoOutbox(Protocol):
    def agregar(self, mensaje: MensajeOutbox) -> MensajeOutbox | None:
        """Guarda el mensaje; devuelve None si ya existía la misma `idempotency_key`."""
        ...

    def obtener_bloqueado(self, outbox_id: str) -> MensajeOutbox | None:
        """Lee y bloquea la fila (SELECT ... FOR UPDATE SKIP LOCKED); None si no existe o la tiene otro worker."""
        ...

    def marcar_enviado(self, outbox_id: str, ahora: datetime) -> None: ...

    def registrar_fallo(
        self, outbox_id: str, intentos: int, estado: EstadoOutbox, proximo_intento: datetime | None, error: str,
    ) -> None: ...

    def ids_pendientes_vencidos(self, ahora: datetime, limite: int) -> list[str]: ...
