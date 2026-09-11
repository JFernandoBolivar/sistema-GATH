"""
Puerto del Repositorio de Reportes (Reglas B1, B21).
"""
from typing import Protocol

from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte


class RepoReportes(Protocol):
    def reporte_personal_activo(self, filtros: dict) -> ResultadoReporte:
        ...

    def reporte_egresos_pasivos(self, filtros: dict) -> ResultadoReporte:
        ...

    def reporte_cargos_vacantes(self, dependencias_ids: list[int] | None = None) -> ResultadoReporte:
        ...

    def reporte_familiares(self, filtros: dict) -> ResultadoReporte:
        ...

    def reporte_codigos(self, filtros: dict) -> ResultadoReporte:
        ...

    def reporte_tendencias_personal(self) -> ResultadoReporte:
        ...
