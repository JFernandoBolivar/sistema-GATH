"""
Puerto del portal del trabajador (Mi expediente / Mi carnet) — Reglas B1, B21.

Autogestión no puede importar casos de uso ni DTOs de personal, familiares o
carnetización (B16): declara aquí lo que necesita y el adaptador de
`infrastructure/` lo implementa leyendo esos módulos.
"""
from typing import Any, Protocol


class RepoPortalTrabajador(Protocol):
    def obtener_empleado(self, cedula: str) -> Any | None:
        """Expediente del trabajador (ya mapeado a DTO), o None si no existe."""
        ...

    def listar_familiares(self, cedula: str) -> list[Any]:
        ...

    def listar_carnets(self, cedula: str) -> list[Any]:
        ...

    def listar_motivos_carnet(self) -> list[dict]:
        ...

    def tiene_carnet_previo(self, cedula: str) -> bool:
        ...

    def emitir_carnet(self, cedula: str, motivo_id: int, observaciones: str) -> Any:
        ...

    def generar_pdf_carnet_activo(self, cedula: str) -> bytes | None:
        """PDF del carnet activo del trabajador, o None si no tiene carnet activo."""
        ...
