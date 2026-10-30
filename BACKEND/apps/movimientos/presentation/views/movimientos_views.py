"""
Vistas delgadas de Movimientos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.

El historial general se pagina en el servidor (10 por defecto, tope 50) y las
exportaciones PDF/Excel aplican el tope configurable de `core`, informan el
truncado en cabeceras y, en el PDF, imprimen los filtros aplicados con sus
etiquetas legibles.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.reportes import limite_de_reporte
from core.presentation.descargas import aplicar_cabeceras_de_truncado
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.movimientos.application.dtos.movimientos_dtos import DocumentoMovimientosDTO
from apps.movimientos.application.use_cases.listar_historial import (
    consultar_historial,
    exportar_historial,
    listar_historial_por_cargo,
    listar_historial_por_empleado,
)
from apps.movimientos.domain.value_objects.paginacion import Paginacion
from apps.movimientos.domain.value_objects.permisos_movimientos import (
    PERMISO_EXPORTAR_EXCEL,
    PERMISO_EXPORTAR_PDF,
    PERMISO_VER,
)
from apps.movimientos.infrastructure.pdf_movimientos import construir_pdf_historial_movimientos
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.movimientos.presentation.serializers.movimientos_serializers import (
    MovimientoCargoSerializer,
)

_PERMISO_VER = HasPermission(PERMISO_VER)
_PERMISO_PDF = HasPermission(PERMISO_EXPORTAR_PDF)
_PERMISO_EXCEL = HasPermission(PERMISO_EXPORTAR_EXCEL)


def _respuesta_pdf(pdf_bytes: bytes, nombre_archivo: str, documento: DocumentoMovimientosDTO) -> HttpResponse:
    respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    aplicar_cabeceras_de_truncado(
        respuesta,
        total_encontrados=documento.total_encontrados,
        limite=documento.limite,
        truncado=documento.truncado,
    )
    return respuesta


def _respuesta_excel(excel_bytes: bytes, nombre_archivo: str, documento: DocumentoMovimientosDTO) -> HttpResponse:
    respuesta = HttpResponse(
        excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    respuesta['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    aplicar_cabeceras_de_truncado(
        respuesta,
        total_encontrados=documento.total_encontrados,
        limite=documento.limite,
        truncado=documento.truncado,
    )
    return respuesta


def _columnas_y_filas(documento: DocumentoMovimientosDTO) -> tuple[list[str], list[dict]]:
    columnas = ['#', 'codigo', 'fecha', 'tipo_movimiento', 'denominacion', 'cargo_especifico', 'grado', 'estatus', 'modificado_por']
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
    return columnas, filas


class HistorialPorEmpleadoView(APIView):
    """GET /api/v1/movimientos/empleado/<cedula>/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(tags=['Movimientos'], summary='Listar historial de movimientos de un empleado', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request, cedula: str):
        repo = RepoMovimientosORM()
        dtos = listar_historial_por_empleado(repo, cedula)
        return ok(MovimientoCargoSerializer(dtos, many=True).data)


class HistorialMovimientosView(APIView):
    """GET /api/v1/movimientos/ — Historial general paginado con filtros opcionales."""
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(tags=['Movimientos'], summary='Listar historial general de movimientos (paginado)')
    def get(self, request):
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        pagina = consultar_historial(
            RepoMovimientosORM(), request.query_params.dict(), paginacion
        )
        return ok({
            'resultados': MovimientoCargoSerializer(pagina.resultados, many=True).data,
            'total': pagina.total,
            'pagina': pagina.pagina,
            'tamano': pagina.tamano,
            'total_paginas': pagina.total_paginas,
        })


class HistorialMovimientosPdfView(APIView):
    """GET /api/v1/movimientos/pdf/ — Historial filtrado en PDF, con los filtros aplicados."""
    permission_classes = [IsAuthenticated, _PERMISO_PDF]

    @extend_schema(tags=['Movimientos'], summary='Exportar el historial de movimientos en PDF')
    def get(self, request):
        documento = exportar_historial(
            RepoMovimientosORM(),
            request.query_params.dict(),
            limite=limite_de_reporte(para_pdf=True),
        )
        pdf_bytes = construir_pdf_historial_movimientos(
            documento.movimientos,
            filtros=documento.filtros,
            usuario_nombre=str(request.user),
            total_encontrados=documento.total_encontrados,
            limite=documento.limite,
            truncado=documento.truncado,
        )
        return _respuesta_pdf(pdf_bytes, 'historial-movimientos.pdf', documento)


class HistorialMovimientosExcelView(APIView):
    """GET /api/v1/movimientos/excel/ — Historial filtrado en Excel (mismos filtros que el PDF)."""
    permission_classes = [IsAuthenticated, _PERMISO_EXCEL]

    @extend_schema(tags=['Movimientos'], summary='Exportar el historial de movimientos en Excel')
    def get(self, request):
        documento = exportar_historial(
            RepoMovimientosORM(),
            request.query_params.dict(),
            limite=limite_de_reporte(para_pdf=False),
        )
        columnas, filas = _columnas_y_filas(documento)
        excel_bytes = generar_reporte_excel('Historial de movimientos', columnas, filas)
        return _respuesta_excel(excel_bytes, 'historial-movimientos.xlsx', documento)


class HistorialPorCargoView(APIView):
    """GET /api/v1/movimientos/cargo/<codigo_puesto>/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(tags=['Movimientos'], summary='Listar historial de movimientos de un cargo', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request, codigo_puesto: str):
        repo = RepoMovimientosORM()
        dtos = listar_historial_por_cargo(repo, codigo_puesto)
        return ok(MovimientoCargoSerializer(dtos, many=True).data)


class TiposMovimientoDisponiblesView(APIView):
    """GET /api/v1/movimientos/tipos/ — Listar tipos y motivos de movimiento existentes en la DB."""
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(tags=['Movimientos'], summary='Listar tipos y motivos de movimiento disponibles en la BD')
    def get(self, request):
        repo = RepoMovimientosORM()
        tipos = repo.listar_tipos_movimiento_disponibles()
        return ok(tipos)
