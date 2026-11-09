"""
Puerto del repositorio de bloqueo de cuentas (B3.12, D-09/B21).

Protocolo puro (regla B1): la implementación compuesta caché + BD vive en
`infrastructure/repositories/repo_bloqueos_cache_db.py` y los dobles de test
en memoria implementan este mismo contrato.
"""
from datetime import datetime
from typing import Protocol

from apps.identidad.domain.entities.bloqueo_cuenta import BloqueoCuenta


class RepoBloqueos(Protocol):
    """Contrato del conteo de intentos fallidos y bloqueo progresivo."""

    def registrar_intento(self, cedula: str) -> BloqueoCuenta:
        """Anota un intento fallido más para la cuenta y devuelve su estado."""
        ...

    def intentos_registrados(self, cedula: str) -> int:
        """Intentos fallidos acumulados dentro de la ventana de conteo."""
        ...

    def aplicar_bloqueo(
        self, cedula: str, hasta: datetime, motivo: str
    ) -> BloqueoCuenta:
        """Deja la cuenta bloqueada hasta el instante indicado."""
        ...

    def esta_bloqueada(self, cedula: str) -> datetime | None:
        """Instante hasta el que permanece bloqueada; None si no hay bloqueo."""
        ...

    def bloqueos_previos(self, cedula: str) -> int:
        """Bloqueos aplicados dentro de la ventana de progresión (gradúa)."""
        ...

    def registrar_incidente(
        self, cedula: str, ip: str | None, resultado: str
    ) -> None:
        """Persiste el incidente de seguridad en la base de datos."""
        ...

    def resetear(self, cedula: str) -> None:
        """Reinicia el conteo de intentos tras un acceso exitoso."""
        ...
