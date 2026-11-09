"""
Entidad de dominio: Elemento de Biblioteca Multimedia (O44 - E4).
Almacena logos, firmas de autoridades, sellos e imágenes institucionales reutilizables.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

CategoriaBiblioteca = Literal["logo", "firma", "imagen"]


@dataclass(frozen=True)
class ElementoBiblioteca:
    id: str
    nombre: str
    categoria: CategoriaBiblioteca
    archivo_url: str
    tamano_bytes: int
    mime_type: str
    ancho_px: int | None
    alto_px: int | None
    creado: datetime
    creado_por: str | None = None
    descripcion: str = ""
