"""
Puerto del Repositorio de Reportes (Reglas B1, B21).
"""
from typing import Protocol

from apps.reportes.domain.entities.consulta_reporte import ConsultaReportePersonal
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte


class RepoReportes(Protocol):
    def reporte_personal_activo(
        self, consulta: ConsultaReportePersonal, limite: int
    ) -> ResultadoReporte:
        ...

    def reporte_egresos_pasivos(self, filtros: dict, limite: int) -> ResultadoReporte:
        ...

    def reporte_cargos_vacantes(
        self, limite: int, dependencias_ids: list[int] | None = None
    ) -> ResultadoReporte:
        ...

    def reporte_familiares(self, filtros: dict, limite: int) -> ResultadoReporte:
        ...

    def reporte_codigos(self, filtros: dict, limite: int) -> ResultadoReporte:
        ...

    def reporte_tendencias_personal(self) -> ResultadoReporte:
        ...

    def reporte_distribucion_nomina(self) -> ResultadoReporte:
        ...
