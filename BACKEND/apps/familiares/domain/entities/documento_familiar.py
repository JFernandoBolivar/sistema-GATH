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
    # Nombre del objeto guardado en el almacenamiento (la tabla legada no
    # conserva el nombre original del archivo subido).
    nombre_archivo: str = ''
