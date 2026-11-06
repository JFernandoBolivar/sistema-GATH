"""
Entidad de dominio para el registro de guías interactivas vistas por cuenta (O35).
"""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class GuiaVista:
    id: str
    cedula: str
    guia_id: str
    version: int
    fecha_vista: datetime
