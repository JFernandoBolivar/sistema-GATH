"""Constancia de fe de vida emitida al validarse la solicitud (PLAN §2.11). Sin Django."""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Certificador:
    """Quien aprobó (nombre y cédula); sin firma digitalizada ni sello."""

    nombre: str
    cedula: str
    rol: str


@dataclass(frozen=True)
class PlantillaConstancia:
    version: int
    titulo: str
    texto: str  # admite {fecha}, {nombre_completo}, {cedula}, {condicion}


@dataclass(frozen=True)
class ConstanciaFeDeVida:
    id: str
    solicitud_id: str
    numero: str
    codigo_verificacion: str
    certificada_por: tuple[Certificador, ...]
    plantilla_version: int
    clave_pdf: str = ''
    emitida_en: datetime | None = None
