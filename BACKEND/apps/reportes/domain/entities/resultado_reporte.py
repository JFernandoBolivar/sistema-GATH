"""
Entidad de Dominio `ResultadoReporte`.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ResultadoReporte:
    titulo: str
    columnas: list[str]
    filas: list[dict]
    total_registros: int
    metadatos: dict = field(default_factory=dict)
