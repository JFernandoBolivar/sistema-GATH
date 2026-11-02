"""
Puerto del Repositorio de Familiares (Reglas B1, B21).
"""
from typing import Protocol

from apps.familiares.domain.entities.documento_familiar import DocumentoFamiliar
from apps.familiares.domain.entities.familiar import Familiar


class RepoFamiliares(Protocol):
    def listar_por_empleado(self, empleado_cedula: str) -> list[Familiar]:
        ...

    def obtener_familiar(self, familiar_id: int) -> Familiar | None:
        ...

    def crear_familiar(self, familiar_datos: dict) -> Familiar:
        ...

    def actualizar_familiar(self, familiar_id: int, datos: dict) -> Familiar:
        ...

    def eliminar_familiar(self, familiar_id: int) -> None:
        ...

    def listar_documentos(self, familiar_id: int) -> list[DocumentoFamiliar]:
        ...

    def obtener_clave_documento(self, familiar_id: int, documento_id: int) -> str | None:
        """Clave del objeto del documento (None si no existe o no es de ese familiar)."""
        ...

    def crear_documento(self, familiar_id: int, tipo_documento: str, clave: str) -> DocumentoFamiliar:
        ...
