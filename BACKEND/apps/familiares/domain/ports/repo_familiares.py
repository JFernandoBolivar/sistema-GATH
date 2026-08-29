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
