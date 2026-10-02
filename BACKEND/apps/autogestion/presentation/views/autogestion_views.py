"""
Vistas delgadas de Autogestión (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
Compatibilidad 100% con la UI de referencia y la nueva arquitectura.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok, fail
from core.presentation.permissions import EsPropiaCedulaOTienePermiso, HasPermission
from apps.autogestion.infrastructure.repositories.repo_autogestion_orm import (
    RepoAutogestionORM,
)


class PreguntasCensoListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Autogestión'], summary='Listar preguntas activas del censo')
    def get(self, request):
        repo = RepoAutogestionORM()
        preguntas = repo.listar_preguntas_con_detalle()
        return ok(preguntas)


class CensoEmpleadoView(APIView):
    """
    Consultar / registrar el censo de una cédula.
    Permite al titular (ALTA-07) o a un analista/administrador consultar o registrar respuestas.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [
                IsAuthenticated(),
                EsPropiaCedulaOTienePermiso('autogestion.censo_actualizar_propio', 'autogestion.censo_ver_todos')(),
            ]
        return [
            IsAuthenticated(),
            EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')(),
        ]

    @extend_schema(tags=['Autogestión'], summary='Consultar respuestas de censo de un empleado')
    def get(self, request, cedula: str):
        repo = RepoAutogestionORM()
        detalle = repo.obtener_detalle_empleado_censo(cedula)
        if detalle is None:
            return ok([], message="Sin respuestas registradas para esta cédula.")
        return ok([detalle])

    @extend_schema(tags=['Autogestión'], summary='Registrar o actualizar respuestas de censo')
    def post(self, request, cedula: str):
        repo = RepoAutogestionORM()
        data = request.data or {}

        # Accept either { carnet_patria, datos_vivienda, respuestas } or { respuestas }
        carnet_patria = data.get('carnet_patria', '')
        datos_vivienda = data.get('datos_vivienda')
        respuestas = data.get('respuestas', [])

        if not respuestas:
            return fail("Debe enviar al menos una respuesta.", status=status.HTTP_400_BAD_REQUEST)

        try:
            detalle = repo.guardar_censo_vivienda(
                cedula=cedula,
                carnet_patria=carnet_patria,
                datos_vivienda=datos_vivienda,
                respuestas=respuestas,
            )
            return ok(detalle, message="Censo de vivienda registrado correctamente", status=status.HTTP_201_CREATED)
        except Exception as e:
            return fail(str(e), status=status.HTTP_400_BAD_REQUEST)


class CensoConsultarView(APIView):
    """
    Consultar todos los censos o buscar por cédula.
    Paridad con /censo-vivienda/consultar/ y /censo-vivienda/consultar/<cedula>/
    """
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Consultar todos los censos o filtrar por cédula')
    def get(self, request, cedula: str | None = None):
        repo = RepoAutogestionORM()
        target_cedula = cedula or request.query_params.get('cedula')
        resultados = repo.consultar_todos_censos(cedula=target_cedula)
        return ok(resultados)


class ReporteCensoDependenciasView(APIView):
    """
    Reporte agregado de censo para gráficos (torta y barras).
    """
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Consolidado del censo por dependencias (RRHH)')
    def get(self, request):
        def _get_int_list(param_name: str) -> list[int]:
            vals = (
                request.query_params.getlist(param_name) +
                request.query_params.getlist(f"{param_name}[]") +
                request.query_params.getlist(f"{param_name}s") +
                request.query_params.getlist(f"{param_name}s[]")
            )
            res = []
            for v in vals:
                if str(v).isdigit():
                    res.append(int(v))
            return res

        dep_ids = _get_int_list("dependencia_id")
        dg_ids = _get_int_list("direccion_general_id")
        dl_ids = _get_int_list("direccion_linea_id")
        coord_ids = _get_int_list("coordinacion_id")

        repo = RepoAutogestionORM()
        reporte = repo.obtener_reporte_dependencias(
            dep_ids=dep_ids or None,
            dg_ids=dg_ids or None,
            dl_ids=dl_ids or None,
            coord_ids=coord_ids or None,
        )
        return ok(reporte)


class MetricasCensoView(APIView):
    """GET /api/v1/autogestion/censo/metricas/ — paridad con métricas del censo."""
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Métricas del censo (RRHH)')
    def get(self, request):
        repo = RepoAutogestionORM()
        return ok(repo.obtener_metricas_censo())


class CensoExcelView(APIView):
    """Exportar respuestas del censo a archivo Excel (.xlsx) con o sin filtros."""
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_exportar')]

    def _generar_respuesta(self, filtros: dict | None):
        repo = RepoAutogestionORM()
        output = repo.generar_excel_censo(filtros)
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="censo_vivienda.xlsx"'
        return response

    @extend_schema(tags=['Autogestión'], summary='Exportar respuestas del censo a Excel (POST con filtros)')
    def post(self, request):
        filtros = request.data.get('filtros') if isinstance(request.data, dict) else {}
        return self._generar_respuesta(filtros)

    @extend_schema(tags=['Autogestión'], summary='Exportar respuestas del censo a Excel (GET general)')
    def get(self, request):
        return self._generar_respuesta(None)
