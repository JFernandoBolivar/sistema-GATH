"""
Puerto del repositorio de Reglas de Catálogos (A5).
"""
from __future__ import annotations

from typing import Protocol, Sequence

from apps.configuracion.domain.reglas_catalogos import (
    CategoriaMotivoItem,
    ReglaMotivo,
    ReglaNomina,
    ReglaParentesco,
)


class RepoReglasCatalogos(Protocol):
    def listar_parentescos(self) -> Sequence[ReglaParentesco]:
        ...

    def obtener_parentesco(self, parentesco_id: int) -> ReglaParentesco:
        ...

    def actualizar_parentesco(self, parentesco_id: int, aplica_familiar: bool) -> ReglaParentesco:
        ...

    def listar_categorias_motivo(self) -> Sequence[CategoriaMotivoItem]:
        ...

    def obtener_categoria_motivo(self, categoria_id: int) -> CategoriaMotivoItem:
        ...

    def listar_motivos(self) -> Sequence[ReglaMotivo]:
        ...

    def obtener_motivo(self, motivo_id: int) -> ReglaMotivo:
        ...

    def contar_motivos_en_categoria(self, categoria_id: int) -> int:
        ...

    def contar_motivos_activos_en_categoria(self, categoria_id: int) -> int:
        ...

    def cambiar_categoria_motivo(self, motivo_id: int, nueva_categoria_id: int) -> ReglaMotivo:
        ...

    def actualizar_motivo(
        self,
        motivo_id: int,
        movimiento: str | None = None,
        categoria_id: int | None = None,
        activo: bool | None = None,
    ) -> ReglaMotivo:
        ...

    def eliminar_motivo(self, motivo_id: int) -> ReglaMotivo:
        ...

    def motivo_tiene_referencias(self, motivo_id: int) -> bool:
        ...

    def crear_motivo(self, movimiento: str, categoria_id: int) -> ReglaMotivo:
        ...

    def listar_nominas(self) -> Sequence[ReglaNomina]:
        ...

    def obtener_nomina(self, nomina_id: int) -> ReglaNomina:
        ...

    def actualizar_nomina(
        self, nomina_id: int, es_activo: bool | None, requiere_codig: bool | None
    ) -> ReglaNomina:
        ...
