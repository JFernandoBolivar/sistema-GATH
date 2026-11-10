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
    # Agrupación jerárquica opcional de una lista (P1 del reporte de RRHH):
    # [{'etiquetas': [('NIVEL', 'NIVEL SUPERIOR'), ('> DG / GEREN / OFIC', '...')],
    #   'desde': 0, 'hasta': 9}, ...]. `desde`/`hasta` son índices en `filas`.
    grupos: list[dict] | None = None
