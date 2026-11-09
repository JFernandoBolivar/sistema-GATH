"""
Vistas delgadas de Movimientos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.

El historial general se pagina en el servidor (10 por defecto, tope 50). Las
exportaciones PDF/Excel son asíncronas: la vista crea el trabajo (202) y el
generador (`infrastructure/exportacion.py`) aplica el tope configurable de `core`,
imprime los filtros con sus etiquetas legibles e informa el truncado.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.movimientos.application.use_cases.listar_historial import (
    consultar_historial,
    listar_historial_por_cargo,
    listar_historial_por_empleado,
)
from apps.exportaciones.presentation.serializers.exportaciones_serializers import (
    TrabajoExportacionSerializer,
)
from apps.exportaciones.presentation.solicitud import pedir_exportacion
from apps.movimientos.domain.value_objects.paginacion import Paginacion
from apps.movimientos.domain.value_objects.permisos_movimientos import (
    PERMISO_EXPORTAR_EXCEL,
    PERMISO_EXPORTAR_PDF,
    PERMISO_VER,
)
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.movimientos.presentation.serializers.movimientos_serializers import (
    MovimientoCargoSerializer,
)

_PERMISO_VER = HasPermission(PERMISO_VER)
_PERMISO_PDF = HasPermission(PERMISO_EXPORTAR_PDF)
_PERMISO_EXCEL = HasPermission(PERMISO_EXPORTAR_EXCEL)


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
    """GET /api/v1/movimientos/pdf/ — encola la exportación del historial filtrado y responde 202."""
    permission_classes = [IsAuthenticated, _PERMISO_PDF]

    @extend_schema(
        tags=['Movimientos'], summary='Exportar el historial de movimientos en PDF (asíncrono)',
        responses={202: TrabajoExportacionSerializer},
    )
    def get(self, request):
        return pedir_exportacion(request, tipo='movimientos', formato='pdf')


class HistorialMovimientosExcelView(APIView):
    """GET /api/v1/movimientos/excel/ — encola la exportación del historial filtrado y responde 202."""
    permission_classes = [IsAuthenticated, _PERMISO_EXCEL]

    @extend_schema(
        tags=['Movimientos'], summary='Exportar el historial de movimientos en Excel (asíncrono)',
        responses={202: TrabajoExportacionSerializer},
    )
    def get(self, request):
        return pedir_exportacion(request, tipo='movimientos', formato='excel')


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
