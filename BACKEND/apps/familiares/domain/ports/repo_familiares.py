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

    def obtener_instancia(self, familiar_id: int):
        """Registro persistido del familiar para validar una edición."""
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

    def obtener_documento_por_tipo(
        self, familiar_id: int, tipo_documento: str
    ) -> DocumentoFamiliar | None:
        """Documento vigente de ese tipo (el más reciente, si hubiera duplicados viejos)."""
        ...

    def obtener_clave_documento_por_tipo(
        self, familiar_id: int, tipo_documento: str
    ) -> str | None:
        """Clave en el almacenamiento del documento de ese tipo (None si no existe)."""
        ...

    def reemplazar_documento(self, familiar_id: int, documento_id: int, clave: str) -> DocumentoFamiliar:
        """Sustituye el archivo de un documento existente del familiar."""
        ...