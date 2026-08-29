"""
Vistas delgadas de Movimientos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.movimientos.application.use_cases.listar_historial import (
    listar_historial_por_cargo,
    listar_historial_por_empleado,
)
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.movimientos.presentation.serializers.movimientos_serializers import (
    MovimientoCargoSerializer,
)


class HistorialPorEmpleadoView(APIView):
    """GET /api/v1/movimientos/empleado/<cedula>/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.ver')]

    @extend_schema(tags=['Movimientos'], summary='Listar historial de movimientos de un empleado', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request, cedula: str):
        repo = RepoMovimientosORM()
        dtos = listar_historial_por_empleado(repo, cedula)
        return ok(MovimientoCargoSerializer(dtos, many=True).data)


class HistorialPorCargoView(APIView):
    """GET /api/v1/movimientos/cargo/<codigo_puesto>/ — Fase 2.5 del plan de reparación."""
    permission_classes = [IsAuthenticated, HasPermission('movimientos.ver')]

    @extend_schema(tags=['Movimientos'], summary='Listar historial de movimientos de un cargo', responses={200: MovimientoCargoSerializer(many=True)})
    def get(self, request, codigo_puesto: str):
        repo = RepoMovimientosORM()
        dtos = listar_historial_por_cargo(repo, codigo_puesto)
        return ok(MovimientoCargoSerializer(dtos, many=True).data)
