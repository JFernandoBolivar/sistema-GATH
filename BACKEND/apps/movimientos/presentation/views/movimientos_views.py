"""
Vistas delgadas de Movimientos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.movimientos.application.use_cases.listar_historial import (
    listar_historial_por_cargo,
    listar_historial_por_empleado,
)
from apps.movimientos.infrastructure.pdf_movimientos import construir_pdf_historial_movimientos
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.movimientos.presentation.serializers.movimientos_serializers import (
    MovimientoCargoSerializer,
)


def _respuesta_pdf(pdf_bytes: bytes, nombre_archivo: str) -> HttpResponse:
    respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    return respuesta


class HistorialPorEmpleadoView(APIView):
    """GET /api/v1/movimientos/empleado/<cedula>/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.ver')]

    @extend_schema(tags=['Movimientos'], summary='Listar historial de movimientos de un empleado', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request, cedula: str):
        repo = RepoMovimientosORM()
        dtos = listar_historial_por_empleado(repo, cedula)
        return ok(MovimientoCargoSerializer(dtos, many=True).data)


class HistorialMovimientosView(APIView):
    """GET /api/v1/movimientos/ — Listar historial general con filtros opcionales."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.ver')]

    @extend_schema(tags=['Movimientos'], summary='Listar historial general de movimientos', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request):
        cedula = request.query_params.get('cedula')
        codigo_puesto = request.query_params.get('codigo_puesto')
        categoria = request.query_params.get('categoria')
        tipo_movimiento = request.query_params.get('tipo_movimiento')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        gerencia = request.query_params.get('gerencia')
        estatus = request.query_params.get('estatus')

        repo = RepoMovimientosORM()
        dtos = repo.listar_historial(
            cedula=cedula,
            codigo_puesto=codigo_puesto,
            categoria=categoria,
            tipo_movimiento=tipo_movimiento,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            gerencia=gerencia,
            estatus=estatus,
        )
        return ok(MovimientoCargoSerializer(dtos, many=True).data)


class HistorialMovimientosPdfView(APIView):
    """GET /api/v1/movimientos/pdf/ — Exportar el historial filtrado en PDF (mismos filtros que HistorialMovimientosView)."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.exportar_pdf')]

    @extend_schema(tags=['Movimientos'], summary='Exportar el historial de movimientos en PDF')
    def get(self, request):
        cedula = request.query_params.get('cedula')
        codigo_puesto = request.query_params.get('codigo_puesto')
        categoria = request.query_params.get('categoria')
        tipo_movimiento = request.query_params.get('tipo_movimiento')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        gerencia = request.query_params.get('gerencia')
        estatus = request.query_params.get('estatus')

        repo = RepoMovimientosORM()
        dtos = repo.listar_historial(
            cedula=cedula,
            codigo_puesto=codigo_puesto,
            categoria=categoria,
            tipo_movimiento=tipo_movimiento,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            gerencia=gerencia,
            estatus=estatus,
        )
        pdf_bytes = construir_pdf_historial_movimientos(dtos, cedula=cedula, usuario_nombre=str(request.user))
        return _respuesta_pdf(pdf_bytes, "historial-movimientos.pdf")


class HistorialPorCargoView(APIView):
    """GET /api/v1/movimientos/cargo/<codigo_puesto>/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.ver')]

    @extend_schema(tags=['Movimientos'], summary='Listar historial de movimientos de un cargo', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request, codigo_puesto: str):
        repo = RepoMovimientosORM()
        dtos = listar_historial_por_cargo(repo, codigo_puesto)
        return ok(MovimientoCargoSerializer(dtos, many=True).data)


class TiposMovimientoDisponiblesView(APIView):
    """GET /api/v1/movimientos/tipos/ — Listar tipos y motivos de movimiento existentes en la DB."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.ver')]

    @extend_schema(tags=['Movimientos'], summary='Listar tipos y motivos de movimiento disponibles en la BD')
    def get(self, request):
        repo = RepoMovimientosORM()
        tipos = repo.listar_tipos_movimiento_disponibles()
        return ok(tipos)

