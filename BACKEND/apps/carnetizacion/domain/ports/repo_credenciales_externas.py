"""Puerto del repositorio de credenciales externas y temporales (O45-A)."""
from datetime import datetime
from typing import Any, Protocol

from apps.carnetizacion.domain.entities.credencial_externa import CredencialExterna


class RepoCredencialesExternas(Protocol):
    def listar(
        self,
        tipo: str | None = None,
        grupo: str | None = None,
        estado: str | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
    ) -> list[CredencialExterna]: ...

    def obtener(self, credencial_id: str) -> CredencialExterna: ...

    def crear(self, **kwargs: Any) -> CredencialExterna: ...

    def devolver(self, credencial_id: str) -> CredencialExterna: ...

    def anular(self, credencial_id: str) -> CredencialExterna: ...

    def marcar_vencidas(self) -> int: ...

    def generar_pdf(self, credencial_id: str) -> bytes: ...

    def generar_pdf_lote(self, ids: list[str]) -> bytes: ...

    def enviar_correo(self, credencial_id: str, destinatario: str | None = None) -> bool: ...
