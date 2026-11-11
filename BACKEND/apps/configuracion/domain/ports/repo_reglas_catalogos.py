"""
Puerto del repositorio de Reglas de Catálogos (A5).
"""
from __future__ import annotations

from typing import Protocol, Sequence

from apps.configuracion.domain.reglas_catalogos import (
    CategoriaMotivoItem,
    ReglaChecklistSoporte,
    ReglaMotivo,
    ReglaNomina,
    ReglaPais,
    ReglaParentesco,
    ReglaTipoSoporte,
)
from core.domain.tipos_soporte import ItemChecklistSoporte, SeccionSoporte


class RepoReglasCatalogos(Protocol):
    def listar_paises(self) -> Sequence[ReglaPais]:
        ...

    def buscar_paises(
        self, *, texto: str = '', pagina: int = 1, tamano_pagina: int = 10,
    ) -> tuple[Sequence[ReglaPais], int]:
        """Países filtrados por texto, con el total, para el buscador paginado."""
        ...

    def obtener_pais(self, pais_id: int) -> ReglaPais:
        ...

    def crear_pais(self, nombre: str, codigo: str) -> ReglaPais:
        ...

    def actualizar_pais(
        self, pais_id: int, nombre: str | None, codigo: str | None,
    ) -> ReglaPais:
        ...

    def eliminar_pais(self, pais_id: int) -> ReglaPais:
        ...

    def pais_tiene_referencias(self, pais_id: int) -> bool:
        ...

    def listar_parentescos(self) -> Sequence[ReglaParentesco]:
        ...

    def obtener_parentesco(self, parentesco_id: int) -> ReglaParentesco:
        ...

    def actualizar_parentesco(
        self, parentesco_id: int, aplica_familiar: bool, descripcion: str | None = None,
        regla: dict | None = None,
    ) -> ReglaParentesco:
        ...

    def crear_parentesco(
        self, descripcion: str, aplica_familiar: bool, regla: dict | None = None,
    ) -> ReglaParentesco:
        ...

    def eliminar_parentesco(self, parentesco_id: int) -> ReglaParentesco:
        ...

    def parentesco_tiene_referencias(self, parentesco_id: int) -> bool:
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
        self,
        nomina_id: int,
        es_activo: bool | None,
        requiere_codig: bool | None,
        nomina: str | None = None,
    ) -> ReglaNomina:
        ...

    def crear_nomina(
        self, nomina: str, es_activo: bool, requiere_codig: bool,
    ) -> ReglaNomina:
        ...

    def eliminar_nomina(self, nomina_id: int) -> ReglaNomina:
        ...

    def nomina_tiene_referencias(self, nomina_id: int) -> bool:
        ...

    # ---- Tipos de soporte documental y checklist por sección (O41) ----
    def listar_tipos_soporte(self) -> Sequence[ReglaTipoSoporte]:
        ...

    def obtener_tipo_soporte(self, tipo_id: int) -> ReglaTipoSoporte:
        ...

    def crear_tipo_soporte(self, codigo: str, nombre: str, orden: int) -> ReglaTipoSoporte:
        ...

    def actualizar_tipo_soporte(
        self,
        tipo_id: int,
        codigo: str | None,
        nombre: str | None,
        orden: int | None,
    ) -> ReglaTipoSoporte:
        ...

    def eliminar_tipo_soporte(self, tipo_id: int) -> ReglaTipoSoporte:
        ...

    def reordenar_tipos_soporte(
        self, ordenes: Sequence[tuple[int, int]],
    ) -> Sequence[ReglaTipoSoporte]:
        ...

    def tipo_soporte_tiene_secciones(self, tipo_id: int) -> bool:
        ...

    def listar_checklist_soporte(
        self, seccion: str | None = None,
    ) -> Sequence[ReglaChecklistSoporte]:
        ...

    def reemplazar_checklist_soporte(
        self, seccion: str, items: Sequence[ItemChecklistSoporte],
    ) -> Sequence[ReglaChecklistSoporte]:
        ...

    def listar_secciones_soporte(self) -> Sequence[SeccionSoporte]:
        ...
