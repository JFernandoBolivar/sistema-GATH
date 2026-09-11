"""
Casos de uso para generación de reportes institucionales.
"""
from apps.reportes.application.dtos.reportes_dtos import ResultadoReporteDTO
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte
from apps.reportes.domain.ports.repo_reportes import RepoReportes


def _resultado_a_dto(r: ResultadoReporte) -> ResultadoReporteDTO:
    return ResultadoReporteDTO(
        titulo=r.titulo,
        columnas=r.columnas,
        filas=r.filas,
        total_registros=r.total_registros,
        metadatos=r.metadatos,
    )


def generar_reporte_personal(repo: RepoReportes, filtros: dict) -> ResultadoReporteDTO:
    entidad = repo.reporte_personal_activo(filtros=filtros)
    return _resultado_a_dto(entidad)


def generar_reporte_pasivos(repo: RepoReportes, filtros: dict) -> ResultadoReporteDTO:
    entidad = repo.reporte_egresos_pasivos(filtros=filtros)
    return _resultado_a_dto(entidad)


def generar_reporte_vacantes(
    repo: RepoReportes, dependencias_ids: list[int] | None = None
) -> ResultadoReporteDTO:
    entidad = repo.reporte_cargos_vacantes(dependencias_ids=dependencias_ids)
    return _resultado_a_dto(entidad)


def generar_reporte_familiares(repo: RepoReportes, filtros: dict) -> ResultadoReporteDTO:
    entidad = repo.reporte_familiares(filtros=filtros)
    return _resultado_a_dto(entidad)


def generar_reporte_codigos(repo: RepoReportes, filtros: dict) -> ResultadoReporteDTO:
    entidad = repo.reporte_codigos(filtros=filtros)
    return _resultado_a_dto(entidad)


def generar_reporte_tendencias(repo: RepoReportes) -> ResultadoReporteDTO:
    entidad = repo.reporte_tendencias_personal()
    return _resultado_a_dto(entidad)
