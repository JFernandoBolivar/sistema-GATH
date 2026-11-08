"""
Entidad de dominio de credenciales externas y temporales (O45-A).
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CredencialExterna:
    id: str
    tipo_credencial: str
    nombre: str
    documento: str
    motivo: str
    vigencia_desde: str
    vigencia_hasta: str
    estado: str
    security_hash: str
    correo: str = ''
    empresa: str = ''
    contrato: str = ''
    persona_visitada: str = ''
    empleado_cedula: str | None = None
    observaciones: str = ''
    devuelta_en: str | None = None
    anulada_en: str | None = None
    datos: dict[str, Any] = field(default_factory=dict)
    plantilla_id: str | None = None
    plantilla_version: int | None = None
