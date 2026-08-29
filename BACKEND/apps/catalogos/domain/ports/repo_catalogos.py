"""
Puerto del Repositorio de Catálogos (Reglas B1, B21).
"""
from typing import Protocol

from apps.catalogos.domain.entities.catalogo_item import CatalogoItem
from apps.catalogos.domain.entities.geografia import Estado, Municipio, Parroquia, Region


class RepoCatalogos(Protocol):
    def listar_regiones(self) -> list[Region]:
        ...

    def listar_estados(self, region_id: int | None = None) -> list[Estado]:
        ...

    def listar_municipios(self, estado_id: int | None = None) -> list[Municipio]:
        ...

    def listar_parroquias(self, municipio_id: int | None = None) -> list[Parroquia]:
        ...

    def listar_sexos(self) -> list[CatalogoItem]:
        ...

    def listar_estatus(self) -> list[CatalogoItem]:
        ...

    def listar_tipos_personal(self) -> list[CatalogoItem]:
        ...

    def listar_tipos_nomina(self) -> list[CatalogoItem]:
        ...

    def listar_parentescos(self) -> list[CatalogoItem]:
        ...

    def listar_tipos_procedencia(self) -> list[CatalogoItem]:
        ...

    def listar_estados_civiles(self) -> list[CatalogoItem]:
        ...

    def listar_grados(self) -> list[CatalogoItem]:
        ...

    def listar_categorias_movimiento(self) -> list[CatalogoItem]:
        ...

    def listar_tipos_movimiento(self, categoria: str | None = None) -> list[CatalogoItem]:
        ...
