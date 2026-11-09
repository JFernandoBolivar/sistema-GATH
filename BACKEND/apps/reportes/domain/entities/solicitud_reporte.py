"""
Entidad de Dominio `SolicitudReporte` (Regla B1).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SolicitudReporte:
    tipo_reporte: str
    formato: str = "json"  # "json", "excel", "pdf"
    filtros: dict = field(default_factory=dict)
