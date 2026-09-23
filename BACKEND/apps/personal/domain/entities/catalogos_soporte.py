"""
Entidades de dominio para catálogos de soporte del expediente de personal
(Reglas B1, B21). Puras: sin dependencias de Django ni librerías de I/O.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CategoriaItem:
    id: int
    nombre: str


@dataclass(frozen=True)
class Alergia:
    id: int
    nombre: str
    categoria_id: int
    categoria_nombre: str = ""


@dataclass(frozen=True)
class Patologia:
    id: int
    nombre: str
    categoria_id: int
    categoria_nombre: str = ""


@dataclass(frozen=True)
class Discapacidad:
    id: int
    nombre: str
    categoria_id: int
    categoria_nombre: str = ""


@dataclass(frozen=True)
class RegionTalla:
    id: int
    codigo: str
    descripcion: str = ""


@dataclass(frozen=True)
class TipoPrenda:
    id: int
    categoria: str


@dataclass(frozen=True)
class Talla:
    id: int
    valor: str
    region_id: int
    tipo_prenda_id: int
    region_codigo: str = ""
    tipo_prenda_nombre: str = ""


@dataclass(frozen=True)
class Carrera:
    id: int
    nombre: str
    nivel_academico_id: int | None = None


@dataclass(frozen=True)
class Mencion:
    id: int
    nombre: str
    carrera_id: int | None = None


@dataclass(frozen=True)
class Institucion:
    id: int
    nombre: str
