"""
Entidad `TrabajoExportacion`: el estado de una exportación asíncrona.

Ciclo: PENDIENTE -> EN_PROCESO -> LISTO | ERROR; un LISTO pasa a EXPIRADO cuando
vence su plazo de descarga y el archivo se borra del almacén.
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class EstadoExportacion(str, Enum):
    PENDIENTE = 'PENDIENTE'
    EN_PROCESO = 'EN_PROCESO'
    LISTO = 'LISTO'
    ERROR = 'ERROR'
    EXPIRADO = 'EXPIRADO'


ESTADOS_ACTIVOS = (EstadoExportacion.PENDIENTE, EstadoExportacion.EN_PROCESO)


@dataclass
class TrabajoExportacion:
    id: str
    solicitante_id: int | None
    solicitante_cedula: str
    tipo: str
    formato: str
    estado: EstadoExportacion
    progreso: int
    parametros: dict
    creado_en: datetime
    expira_en: datetime
    nombre_archivo: str = ''
    clave_archivo: str = ''
    tamano_bytes: int = 0
    metadatos: dict = field(default_factory=dict)
    error: str = ''
    task_id: str = ''
    finalizado_en: datetime | None = None
