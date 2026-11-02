"""
Entidad de Dominio `DocumentoFamiliar`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentoFamiliar:
    id: int
    familiar_id: int
    tipo_documento: str
    ruta_archivo: str
    fecha_subida: str
