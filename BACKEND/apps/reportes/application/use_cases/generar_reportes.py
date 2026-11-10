"""
Casos de uso para generación de reportes institucionales.
"""
from datetime import date

from apps.reportes.application.dtos.reportes_dtos import ResultadoReporteDTO
from apps.reportes.domain.entities.consulta_reporte import ConsultaReportePersonal
from apps.reportes.domain.value_objects.condicion_trabajador import (
    CONDICION_ACTIVO,
    normalizar_condicion,
)
from core.domain.exceptions import ValidationError
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
        grupos=r.grupos,
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


def generar_reporte_pasivos_actuales(
    repo: RepoReportes,
    filtros: dict,
    registro: ReportFieldRegistry,
    puede_filtrar_estructura: bool,
    limite: int,
    hoy: date | None = None,
) -> ResultadoReporteDTO:
    """Reporte de pasivos con el mismo formulario de filtros que activos.

    Se usa para el PDF/Excel de `/pasivos/reportes`; el JSON de egresados
    conserva su caso de uso histórico.
    """
    consulta = preparar_consulta_personal(
        filtros=filtros,
        configuracion=registro.configuracion('empleados'),
        puede_filtrar_estructura=puede_filtrar_estructura,
        hoy=hoy,
    )
    entidad = repo.reporte_pasivos(consulta, limite)
    return _resultado_a_dto(entidad)


def generar_reporte_vacantes(
    repo: RepoReportes, limite: int, dependencias_ids: list[int] | None = None
) -> ResultadoReporteDTO:
    entidad = repo.reporte_cargos_vacantes(limite, dependencias_ids=dependencias_ids)
    return _resultado_a_dto(entidad)


def preparar_consulta_familiares(
    filtros: dict,
    registro: ReportFieldRegistry | None,
    puede_filtrar_estructura: bool = False,
    hoy: date | None = None,
) -> tuple[ConsultaReportePersonal, str | None]:
    """Valida los filtros del reporte de familiares sin consultar la base.

    Devuelve la consulta (lookups del registro) y la cedula del trabajador, que
    no pasa por el registro. `sexo_id` se acepta como alias de `sexo_familiar_id`.
    """
    filtros = dict(filtros or {})
    cedula_empleado = str(filtros.pop('cedula_empleado', '') or '').strip() or None
    if 'sexo_id' in filtros:
        filtros.setdefault('sexo_familiar_id', filtros.pop('sexo_id'))

    if registro is None:
        if any(valor not in (None, '') for valor in filtros.values()):
            raise ValidationError('El reporte de familiares necesita el registro de campos para filtrar.')
        return ConsultaReportePersonal(), cedula_empleado
    consulta = preparar_consulta_personal(
        filtros=filtros,
        configuracion=registro.configuracion('familiares'),
        puede_filtrar_estructura=puede_filtrar_estructura,
        hoy=hoy,
    )
    return consulta, cedula_empleado


def generar_reporte_familiares(
    repo: RepoReportes,
    filtros: dict,
    limite: int,
    condicion: str = CONDICION_ACTIVO,
    registro: ReportFieldRegistry | None = None,
    puede_filtrar_estructura: bool = False,
    hoy: date | None = None,
) -> ResultadoReporteDTO:
    """Familiares de trabajadores ACTIVOS o PASIVOS, con los filtros del formulario.

    `condicion` es un valor cerrado (ACTIVO/PASIVO) que decide de que trabajadores
    se listan los familiares; los filtros se validan contra la categoria
    `familiares` del registro de campos (una clave desconocida es un 400).
    `cedula_empleado` y `sexo_id` se conservan como alias del contrato anterior.
    """
    condicion = normalizar_condicion(condicion)
    consulta, cedula_empleado = preparar_consulta_familiares(
        filtros, registro, puede_filtrar_estructura, hoy,
    )
    entidad = repo.reporte_familiares(
        consulta, limite, condicion=condicion, cedula_empleado=cedula_empleado,
    )
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
