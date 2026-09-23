"""
Puerto del Repositorio de Catálogos de Soporte (Reglas B1, B21).
Puro: Protocol de typing, sin dependencias de Django.
"""
from typing import Protocol

from apps.personal.domain.entities.catalogos_soporte import (
    Alergia,
    CategoriaItem,
    Discapacidad,
    Patologia,
    RegionTalla,
    Talla,
    TipoPrenda,
    Carrera,
    Institucion,
    Mencion,
)


class RepoCatalogosSoporte(Protocol):
    # Alergias
    def crear_alergia(self, nombre: str, categoria_id: int) -> Alergia:
        ...

    def actualizar_alergia(self, id: int, nombre: str, categoria_id: int) -> Alergia:
        ...

    def eliminar_alergia(self, id: int) -> None:
        ...

    def listar_categorias_alergia(self) -> list[CategoriaItem]:
        ...

    def crear_categoria_alergia(self, nombre: str) -> CategoriaItem:
        ...

    def eliminar_categoria_alergia(self, id: int) -> None:
        ...

    # Patologías
    def crear_patologia(self, nombre: str, categoria_id: int) -> Patologia:
        ...

    def actualizar_patologia(self, id: int, nombre: str, categoria_id: int) -> Patologia:
        ...

    def eliminar_patologia(self, id: int) -> None:
        ...

    def listar_categorias_patologia(self) -> list[CategoriaItem]:
        ...

    def crear_categoria_patologia(self, nombre: str) -> CategoriaItem:
        ...

    def eliminar_categoria_patologia(self, id: int) -> None:
        ...

    # Discapacidades
    def crear_discapacidad(self, nombre: str, categoria_id: int) -> Discapacidad:
        ...

    def actualizar_discapacidad(self, id: int, nombre: str, categoria_id: int) -> Discapacidad:
        ...

    def eliminar_discapacidad(self, id: int) -> None:
        ...

    def listar_categorias_discapacidad(self) -> list[CategoriaItem]:
        ...

    def crear_categoria_discapacidad(self, nombre: str) -> CategoriaItem:
        ...

    def eliminar_categoria_discapacidad(self, id: int) -> None:
        ...

    # Tallas
    def crear_talla(self, valor: str, region_id: int, tipo_prenda_id: int) -> Talla:
        ...

    def actualizar_talla(self, id: int, valor: str, region_id: int, tipo_prenda_id: int) -> Talla:
        ...

    def eliminar_talla(self, id: int) -> None:
        ...

    # Regiones de Talla
    def crear_region_talla(self, codigo: str, descripcion: str | None = None) -> RegionTalla:
        ...

    def actualizar_region_talla(self, id: int, codigo: str, descripcion: str | None = None) -> RegionTalla:
        ...

    def eliminar_region_talla(self, id: int) -> None:
        ...

    # Tipos de Prenda
    def crear_tipo_prenda(self, categoria: str) -> TipoPrenda:
        ...

    def actualizar_tipo_prenda(self, id: int, categoria: str) -> TipoPrenda:
        ...

    def eliminar_tipo_prenda(self, id: int) -> None:
        ...

    # Alta inline de catálogos académicos ("Otra X" del registro)
    def crear_carrera(self, nombre: str, nivel_academico_id: int) -> Carrera:
        ...

    def crear_mencion(self, nombre: str, carrera_id: int) -> Mencion:
        ...

    def crear_institucion(self, nombre: str) -> Institucion:
        ...
