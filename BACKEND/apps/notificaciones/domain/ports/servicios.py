"""Puertos de servicios externos de notificaciones: destinatarios, envío, caché y planificación."""
from typing import Protocol


class ResolutorDestinatarios(Protocol):
    def cedulas_con_permiso(self, codigo_permiso: str) -> list[str]:
        """Cédulas de las cuentas ACTIVAS que tienen el permiso (rol + ajustes individuales)."""
        ...

    def correo_de(self, cedula: str) -> str:
        """Correo principal de la persona ('' si no tiene)."""
        ...


class EnviadorCorreo(Protocol):
    def enviar(
        self, *, destinatario: str, copia_a: tuple[str, ...], asunto: str, texto: str, html: str,
        adjuntos: list[tuple[str, bytes, str]],
    ) -> None:
        """Envía el correo o lanza excepción si el transporte falla."""
        ...


class CacheConteo(Protocol):
    """Caché del contador de no leídas. Debe degradar en silencio si la caché no responde."""

    def obtener(self, cedula: str) -> int | None: ...

    def guardar(self, cedula: str, total: int) -> None: ...

    def invalidar(self, cedula: str) -> None:
        """Invalida DESPUÉS del commit de la transacción vigente."""
        ...


class PlanificadorEnvio(Protocol):
    def programar(self, outbox_id: str) -> None:
        """Encola el envío del mensaje DESPUÉS del commit (on_commit); un fallo del broker no revierte nada."""
        ...
