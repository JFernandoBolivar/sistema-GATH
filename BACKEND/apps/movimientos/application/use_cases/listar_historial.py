"""
Casos de uso de consulta del historial de movimientos de cargo (Fase 2.5
del plan de reparación). Réplica funcional de
`RAC/views/historial_views.py::listar_historial_cargo`.
"""
from apps.movimientos.application.dtos.movimientos_dtos import (
    DocumentoMovimientosDTO,
    MovimientoCargoDTO,
    PaginaMovimientosDTO,
)
from apps.movimientos.domain.ports.repo_movimientos import RepoMovimientos
from apps.movimientos.domain.value_objects.filtros_historial import FiltrosHistorial
from apps.movimientos.domain.value_objects.paginacion import Paginacion


def _a_dto(entidad) -> MovimientoCargoDTO:
    return MovimientoCargoDTO(
        id=entidad.id,
        empleado_cedula=entidad.empleado_cedula,
        codigo_puesto=entidad.codigo_puesto,
        tipo_movimiento=entidad.tipo_movimiento,
        motivo_id=entidad.motivo_id,
        motivo_nombre=entidad.motivo_nombre,
        denominacion_nombre=entidad.denominacion_nombre,
        especifica_nombre=entidad.especifica_nombre,
        grado_nombre=entidad.grado_nombre,
        tipo_nomina_nombre=entidad.tipo_nomina_nombre,
        estatus_nombre=entidad.estatus_nombre,
        tipo_personal_nombre=entidad.tipo_personal_nombre,
        dependencia_nombre=entidad.dependencia_nombre,
        direccion_general_nombre=entidad.direccion_general_nombre,
        direccion_linea_nombre=entidad.direccion_linea_nombre,
        coordinacion_nombre=entidad.coordinacion_nombre,
        fecha_movimiento=entidad.fecha_movimiento,
        ejecutado_por_id=entidad.ejecutado_por_id,
        ejecutado_por_nombre=entidad.ejecutado_por_nombre,
    )


def listar_historial_por_empleado(repo: RepoMovimientos, cedula: str) -> list[MovimientoCargoDTO]:
    return [_a_dto(e) for e in repo.listar_historial_por_empleado(cedula)]


def listar_historial_por_cargo(repo: RepoMovimientos, codigo_puesto: str) -> list[MovimientoCargoDTO]:
    return [_a_dto(e) for e in repo.listar_historial_por_cargo(codigo_puesto)]


def consultar_historial(
    repo: RepoMovimientos, parametros: dict, paginacion: Paginacion
) -> PaginaMovimientosDTO:
    """Página del historial validada (RN-008-01) y paginada en el servidor."""
    filtros = FiltrosHistorial.desde_parametros(parametros)
    entidades, total = repo.listar_historial(
        filtros, limite=paginacion.tamano, offset=paginacion.offset
    )
    return PaginaMovimientosDTO(
        resultados=[_a_dto(e) for e in entidades],
        total=total,
        pagina=paginacion.pagina,
        tamano=paginacion.tamano,
    )


def exportar_historial(
    repo: RepoMovimientos, parametros: dict, limite: int
) -> DocumentoMovimientosDTO:
    """Contenido del PDF/Excel: filas, filtros legibles y aviso de truncado."""
    filtros = FiltrosHistorial.desde_parametros(parametros)
    entidades, total = repo.listar_historial(filtros, limite=limite, offset=0)
    return DocumentoMovimientosDTO(
        movimientos=[_a_dto(e) for e in entidades],
        filtros=filtros.como_etiquetas(),
        total_encontrados=total,
        limite=limite,
        truncado=bool(limite > 0 and total > limite),
    )
