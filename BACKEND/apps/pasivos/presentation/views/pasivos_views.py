"""
Vistas delgadas de Pasivos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permiso `pasivos.ver`.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.pasivos.application.dtos.pasivos_dtos import ProcesarEgresoDTO
from apps.pasivos.application.use_cases.listar_pasivos import listar_pasivos
from apps.pasivos.application.use_cases.obtener_pasivo import obtener_pasivo_por_cedula
from apps.pasivos.application.use_cases.procesar_egreso import procesar_egreso
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.pasivos.presentation.serializers.pasivos_serializers import (
    PasivoSerializer,
    ProcesarEgresoInputSerializer,
)


class PasivosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.ver')]

    @extend_schema(tags=['Pasivos'], summary='Listar trabajadores jubilados y pensionados', responses={200: PasivoSerializer(many=True)})
    def get(self, request):
        busqueda = request.query_params.get('q')
        repo = RepoPasivosORM()
        dtos = listar_pasivos(repo, busqueda=busqueda)
        return ok(PasivoSerializer(dtos, many=True).data)


class PasivoDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.ver')]

    @extend_schema(tags=['Pasivos'], summary='Obtener expediente de trabajador pasivo por cédula', responses={200: PasivoSerializer})
    def get(self, request, cedula: str):
        repo = RepoPasivosORM()
        dto = obtener_pasivo_por_cedula(repo, cedula=cedula)
        return ok(PasivoSerializer(dto).data)


class ProcesarEgresoView(APIView):
    """
    POST /api/v1/pasivos/<cedula>/procesar-egreso/ — transición activo →
    pasivo (Fase 2.1 del plan de reparación). Antes de este endpoint,
    `apps.pasivos` solo podía listar pasivos ya existentes; no había forma
    de crear la transición.
    """

    permission_classes = [IsAuthenticated, HasPermission('pasivos.cambiar_condicion')]

    @extend_schema(
        tags=['Pasivos'],
        summary='Procesar transición activo → pasivo',
        request=ProcesarEgresoInputSerializer,
        responses={200: PasivoSerializer},
    )
    def post(self, request, cedula: str):
        serializer = ProcesarEgresoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoPasivosORM()
        dto = procesar_egreso(
            repo,
            ProcesarEgresoDTO(
                cedula=cedula,
                motivo_movimiento_id=datos['motivo_movimiento_id'],
                tipo_nomina_id=datos['tipo_nomina_id'],
                liberar_activos=datos['liberar_activos'],
                usuario_id=request.user.pk,
            ),
        )
        return ok(PasivoSerializer(dto).data, 'Transición a pasivo procesada correctamente.')
