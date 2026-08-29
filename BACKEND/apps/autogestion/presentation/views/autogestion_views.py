"""
Vistas delgadas de Autogestión (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import EsPropiaCedulaOTienePermiso, HasPermission
from apps.autogestion.application.use_cases.consultar_censo import (
    consultar_censo_empleado,
    registrar_respuestas_censo,
)
from apps.autogestion.application.use_cases.listar_preguntas import listar_preguntas_censo
from apps.autogestion.application.use_cases.reporte_censo import (
    obtener_reporte_censo_dependencias,
)
from apps.autogestion.infrastructure.repositories.repo_autogestion_orm import (
    RepoAutogestionORM,
)
from apps.autogestion.presentation.serializers.autogestion_serializers import (
    PreguntaEncuestaSerializer,
    RegistrarCensoInputSerializer,
    RespuestaEncuestaSerializer,
)


class PreguntasCensoListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('autogestion.ver')]

    @extend_schema(tags=['Autogestión'], summary='Listar preguntas activas del censo', responses={200: PreguntaEncuestaSerializer(many=True)})
    def get(self, request):
        repo = RepoAutogestionORM()
        dtos = listar_preguntas_censo(repo)
        return ok(PreguntaEncuestaSerializer(dtos, many=True).data)


class CensoEmpleadoView(APIView):
    """
    Consultar/registrar el censo de una cédula (ALTA-07): el acceso solo se
    concede sobre la cédula propia del titular autenticado, salvo bypass
    explícito de RRHH en lectura. No hay bypass de escritura — ningún rol
    sembrado tiene 'autogestion.censo_actualizar_todos'; nadie edita el censo
    ajeno.
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), EsPropiaCedulaOTienePermiso('autogestion.censo_actualizar_propio')()]
        return [
            IsAuthenticated(),
            EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')(),
        ]

    @extend_schema(tags=['Autogestión'], summary='Consultar respuestas de censo de un empleado', responses={200: RespuestaEncuestaSerializer(many=True)})
    def get(self, request, cedula: str):
        repo = RepoAutogestionORM()
        dtos = consultar_censo_empleado(repo, empleado_cedula=cedula)
        return ok(RespuestaEncuestaSerializer(dtos, many=True).data)

    @extend_schema(tags=['Autogestión'], summary='Registrar o actualizar respuestas de censo', request=RegistrarCensoInputSerializer, responses={200: RespuestaEncuestaSerializer(many=True)})
    def post(self, request, cedula: str):
        serializer = RegistrarCensoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoAutogestionORM()
        dtos = registrar_respuestas_censo(
            repo,
            empleado_cedula=cedula,
            respuestas=serializer.validated_data['respuestas'],
        )
        return ok(RespuestaEncuestaSerializer(dtos, many=True).data)


class ReporteCensoDependenciasView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Consolidado del censo por dependencias (RRHH)', responses={200: None})
    def get(self, request):
        repo = RepoAutogestionORM()
        reporte = obtener_reporte_censo_dependencias(repo)
        return ok(reporte)
