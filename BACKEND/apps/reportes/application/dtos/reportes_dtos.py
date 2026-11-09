"""
DTOs de Reportes (Regla B5).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ResultadoReporteDTO:
    titulo: str
    columnas: list[str]
    filas: list[dict]
    total_registros: int
    metadatos: dict = field(default_factory=dict)
