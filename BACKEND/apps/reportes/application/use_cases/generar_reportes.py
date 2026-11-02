"""
Casos de uso para generación de reportes institucionales.
"""
from datetime import date

from apps.reportes.application.dtos.reportes_dtos import ResultadoReporteDTO
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte
from apps.reportes.domain.ports.repo_reportes import RepoReportes
from apps.reportes.domain.services.filtros_reporte_personal import (
    preparar_consulta_personal,
)
from core.domain.ports import ReportFieldRegistry


def _resultado_a_dto(r: ResultadoReporte) -> ResultadoReporteDTO:
    return ResultadoReporteDTO(
        titulo=r.titulo,
        columnas=r.columnas,
        filas=r.filas,
        total_registros=r.total_registros,
        metadatos=r.metadatos,
    )


def generar_reporte_personal(
    repo: RepoReportes,
    filtros: dict,
    registro: ReportFieldRegistry,
    puede_filtrar_estructura: bool,
    limite: int,
    hoy: date | None = None,
) -> ResultadoReporteDTO:
    """Valida los filtros contra el registro de campos y ejecuta la consulta.

    `puede_filtrar_estructura` es la decisión ya evaluada del permiso
    `organizacion.ver` (el motor IAM no vive en este módulo); el dominio aplica
    la regla. `limite` lo fija quien conoce el formato de salida (un PDF nunca
    se genera sin tope) y es obligatorio: `0` significa «sin tope».
    """
    consulta = preparar_consulta_personal(
        filtros=filtros,
        configuracion=registro.configuracion('empleados'),
        puede_filtrar_estructura=puede_filtrar_estructura,
        hoy=hoy,
    )
    entidad = repo.reporte_personal_activo(consulta, limite)
    return _resultado_a_dto(entidad)


def generar_reporte_pasivos(
    repo: RepoReportes, filtros: dict, limite: int
) -> ResultadoReporteDTO:
    entidad = repo.reporte_egresos_pasivos(filtros=filtros, limite=limite)
    return _resultado_a_dto(entidad)


def generar_reporte_vacantes(
    repo: RepoReportes, limite: int, dependencias_ids: list[int] | None = None
) -> ResultadoReporteDTO:
    entidad = repo.reporte_cargos_vacantes(limite, dependencias_ids=dependencias_ids)
    return _resultado_a_dto(entidad)


def generar_reporte_familiares(
    repo: RepoReportes, filtros: dict, limite: int
) -> ResultadoReporteDTO:
    entidad = repo.reporte_familiares(filtros=filtros, limite=limite)
    return _resultado_a_dto(entidad)


def generar_reporte_codigos(
    repo: RepoReportes, filtros: dict, limite: int
) -> ResultadoReporteDTO:
    entidad = repo.reporte_codigos(filtros=filtros, limite=limite)
    return _resultado_a_dto(entidad)


def generar_reporte_tendencias(repo: RepoReportes) -> ResultadoReporteDTO:
    entidad = repo.reporte_tendencias_personal()
    return _resultado_a_dto(entidad)


def generar_reporte_distribucion_nomina(repo: RepoReportes) -> ResultadoReporteDTO:
    entidad = repo.reporte_distribucion_nomina()
    return _resultado_a_dto(entidad)
