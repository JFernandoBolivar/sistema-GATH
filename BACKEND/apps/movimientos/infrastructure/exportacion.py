"""
Generación del PDF/Excel del historial de movimientos (exportación en segundo plano).

Mismo generador que usaba la vista síncrona. Lo invoca el worker de
`apps.exportaciones`; la vista llama a `validar_parametros` antes de encolar.
"""
from typing import Callable

from apps.movimientos.application.dtos.movimientos_dtos import DocumentoMovimientosDTO
from apps.movimientos.application.use_cases.listar_historial import exportar_historial
from apps.movimientos.domain.value_objects.filtros_historial import FiltrosHistorial
from apps.movimientos.infrastructure.pdf_movimientos import construir_pdf_historial_movimientos
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.reportes import limite_de_reporte

COLUMNAS = [
    '#', 'codigo', 'fecha', 'tipo_movimiento', 'denominacion',
    'cargo_especifico', 'grado', 'estatus', 'modificado_por',
]


def columnas_y_filas(documento: DocumentoMovimientosDTO) -> tuple[list[str], list[dict]]:
    filas = [
        {
            '#': idx + 1,
            'codigo': m.codigo_puesto or 'N/A',
            'fecha': m.fecha_movimiento,
            'tipo_movimiento': m.tipo_movimiento or 'N/A',
            'denominacion': m.denominacion_nombre or 'N/A',
            'cargo_especifico': m.especifica_nombre or 'N/A',
            'grado': m.grado_nombre or 'N/A',
            'estatus': m.estatus_nombre or 'N/A',
            'modificado_por': m.ejecutado_por_nombre or 'N/A',
        }
        for idx, m in enumerate(documento.movimientos)
    ]
    return list(COLUMNAS), filas


def validar_parametros(parametros: dict) -> None:
    """400 si los filtros son inválidos (sin consultar la base)."""
    FiltrosHistorial.desde_parametros(parametros.get('filtros') or {})


def generar_archivo_movimientos(
    formato: str, parametros: dict, progreso: Callable[[int], None],
) -> tuple[bytes, dict]:
    para_pdf = formato == 'pdf'
    documento = exportar_historial(
        RepoMovimientosORM(),
        parametros.get('filtros') or {},
        limite=limite_de_reporte(para_pdf=para_pdf),
    )
    progreso(60)
    if para_pdf:
        contenido = construir_pdf_historial_movimientos(
            documento.movimientos,
            filtros=documento.filtros,
            usuario_nombre=str(parametros.get('usuario_nombre') or ''),
            total_encontrados=documento.total_encontrados,
            limite=documento.limite,
            truncado=documento.truncado,
        )
    else:
        columnas, filas = columnas_y_filas(documento)
        contenido = generar_reporte_excel('Historial de movimientos', columnas, filas)
    return contenido, {
        'total_encontrados': documento.total_encontrados,
        'limite': documento.limite,
        'truncado': documento.truncado,
    }
