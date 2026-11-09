"""Fila del listado exportable de la bandeja de fe de vida (O23). Sin Django."""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PasivoBandeja:
    cedula: str
    nombres: str
    apellidos: str
    correo: str
    telefono: str
    estado: str
    fecha_envio: datetime | None
    numero_acta: str = ''
