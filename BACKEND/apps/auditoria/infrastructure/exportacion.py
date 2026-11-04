"""
Generación del PDF/Excel de la bitácora de auditoría (exportación en segundo plano).

Mismo generador que usaba la vista síncrona. Lo invoca el worker de
`apps.exportaciones`; la vista llama a `validar_parametros` antes de encolar.
"""
from datetime import datetime
from typing import Callable

from apps.auditoria.application.use_cases.consultar_auditoria import exportar_auditoria
from apps.auditoria.domain.value_objects.filtros_auditoria import FiltrosAuditoria
from apps.auditoria.infrastructure.repositories.repo_auditoria_orm import RepoAuditoriaORM
from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf
from core.infrastructure.reportes import limite_de_reporte

TITULO = 'Bitácora de auditoría'
COLUMNAS = [
    '#', 'fecha', 'usuario', 'rol', 'accion', 'modulo',
    'recurso', 'ip', 'dispositivo', 'resultado',
]


def _fecha_legible(valor: str) -> str:
    try:
        return datetime.fromisoformat(valor).strftime('%d/%m/%Y %H:%M:%S')
    except (TypeError, ValueError):
        return valor


def filas_de(registros) -> list[dict]:
    return [
        {
            '#': indice + 1,
            'fecha': _fecha_legible(r.fecha_hora),
            'usuario': f'{r.actor_cedula} {r.actor_nombre}'.strip() or '—',
            'rol': r.actor_rol or '—',
            'accion': r.accion,
            'modulo': r.modulo,
            'recurso': f'{r.recurso_tipo}#{r.recurso_id}'.strip('#') or '—',
            'ip': r.ip or '—',
            'dispositivo': r.user_agent or '—',
            'resultado': r.resultado,
        }
        for indice, r in enumerate(registros)
    ]


def validar_parametros(parametros: dict) -> None:
    """400 si los filtros son inválidos (sin consultar la base)."""
    FiltrosAuditoria.desde_parametros(parametros.get('filtros') or {})


def generar_archivo_auditoria(
    formato: str, parametros: dict, progreso: Callable[[int], None],
) -> tuple[bytes, dict]:
    para_pdf = formato == 'pdf'
    filtros = FiltrosAuditoria.desde_parametros(parametros.get('filtros') or {})
    documento = exportar_auditoria(
        RepoAuditoriaORM(), filtros, limite_de_reporte(para_pdf=para_pdf),
    )
    progreso(60)
    filas = filas_de(documento.registros)
    if para_pdf:
        contenido = generar_reporte_pdf(TITULO, COLUMNAS, filas, filtros=documento.filtros)
    else:
        contenido = generar_reporte_excel(TITULO, COLUMNAS, filas, filtros=documento.filtros)
    return contenido, {
        'total_encontrados': documento.total_encontrados,
        'limite': documento.limite,
        'truncado': documento.truncado,
    }
