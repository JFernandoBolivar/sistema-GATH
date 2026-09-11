"""
Vistas delgadas de Reportes (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_codigos,
    generar_reporte_familiares,
    generar_reporte_pasivos,
    generar_reporte_personal,
    generar_reporte_tendencias,
    generar_reporte_vacantes,
)
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from apps.reportes.presentation.serializers.reportes_serializers import ResultadoReporteSerializer


def _respuesta_pdf(pdf_bytes: bytes, nombre_archivo: str) -> HttpResponse:
    respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    return respuesta


def _respuesta_excel(excel_bytes: bytes, nombre_archivo: str) -> HttpResponse:
    respuesta = HttpResponse(
        excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    respuesta['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    return respuesta


class ReportePersonalActivoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.ver')]

    @extend_schema(tags=['Reportes'], summary='Generar reporte consolidado de personal activo', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_personal(repo, filtros=filtros)
        return ok(ResultadoReporteSerializer(dto).data)


class ReportePersonalActivoPdfView(APIView):
    """GET /api/v1/reportes/personal-activo/pdf/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_pdf')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de personal activo en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_personal(repo, filtros=filtros)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_pdf(pdf_bytes, 'reporte_personal_activo.pdf')


class ReportePersonalActivoExcelView(APIView):
    """GET /api/v1/reportes/personal-activo/excel/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_excel')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de personal activo en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_personal(repo, filtros=filtros)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_personal_activo.xlsx')


class ReportePasivosView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.ver')]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de personal pasivo y egresados', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_pasivos(repo, filtros=filtros)
        return ok(ResultadoReporteSerializer(dto).data)


class ReportePasivosPdfView(APIView):
    """GET /api/v1/reportes/pasivos/pdf/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_pdf')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de pasivos en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_pasivos(repo, filtros=filtros)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_pdf(pdf_bytes, 'reporte_pasivos.pdf')


class ReportePasivosExcelView(APIView):
    """GET /api/v1/reportes/pasivos/excel/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_excel')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de pasivos en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_pasivos(repo, filtros=filtros)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_pasivos.xlsx')


class ReporteVacantesView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.ver')]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de cargos vacantes', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_vacantes(repo)
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteVacantesPdfView(APIView):
    """GET /api/v1/reportes/cargos-vacantes/pdf/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_pdf')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de cargos vacantes en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_vacantes(repo)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_pdf(pdf_bytes, 'reporte_cargos_vacantes.pdf')


class ReporteVacantesExcelView(APIView):
    """GET /api/v1/reportes/cargos-vacantes/excel/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_excel')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de cargos vacantes en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_vacantes(repo)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_cargos_vacantes.xlsx')


class ReporteFamiliaresView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.ver')]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de familiares (cargas familiares)', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_familiares(repo, filtros=filtros)
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteFamiliaresPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_pdf')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de familiares en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_familiares(repo, filtros=filtros)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_pdf(pdf_bytes, 'reporte_familiares.pdf')


class ReporteFamiliaresExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_excel')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de familiares en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_familiares(repo, filtros=filtros)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_familiares.xlsx')


class ReporteCodigosView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.ver')]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de códigos de cargo (asignaciones)', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_codigos(repo, filtros=filtros)
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteCodigosPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_pdf')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de códigos de cargo en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_codigos(repo, filtros=filtros)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_pdf(pdf_bytes, 'reporte_codigos.pdf')


class ReporteCodigosExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_excel')]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de códigos de cargo en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        filtros = {k: v for k, v in request.query_params.items()}
        dto = generar_reporte_codigos(repo, filtros=filtros)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_codigos.xlsx')


class ReporteTendenciasView(APIView):
    """GET /api/v1/reportes/tendencias/ — series mensuales de ingresos/egresos
    de personal (últimos 12 meses) para gráficas de tendencia del frontend."""

    permission_classes = [IsAuthenticated, HasPermission('reportes.estadisticas')]

    @extend_schema(tags=['Reportes'], summary='Tendencia mensual de ingresos y egresos de personal', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_tendencias(repo)
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteTendenciasPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_pdf')]

    @extend_schema(tags=['Reportes'], summary='Descargar la tendencia de personal en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_tendencias(repo)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_pdf(pdf_bytes, 'reporte_tendencias.pdf')


class ReporteTendenciasExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('reportes.generar_excel')]

    @extend_schema(tags=['Reportes'], summary='Descargar la tendencia de personal en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_tendencias(repo)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_tendencias.xlsx')
