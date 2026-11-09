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
from core.infrastructure.report_field_registry import ReportFieldRegistryORM
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso
from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_codigos,
    generar_reporte_distribucion_nomina,
    generar_reporte_familiares,
    generar_reporte_pasivos,
    generar_reporte_pasivos_actuales,
    generar_reporte_personal,
    generar_reporte_tendencias,
    generar_reporte_vacantes,
)
from apps.reportes.domain.value_objects.permisos_reportes import (
    PERMISO_ESTADISTICAS,
    PERMISO_ESTRUCTURA_ORGANIZATIVA,
    PERMISO_GENERAR_EXCEL,
    PERMISO_GENERAR_PDF,
    PERMISO_VER_REPORTES,
)
from core.infrastructure.reportes import limite_de_reporte
from core.presentation.descargas import aplicar_cabeceras_de_truncado
from apps.exportaciones.presentation.serializers.exportaciones_serializers import (
    TrabajoExportacionSerializer,
)
from apps.exportaciones.presentation.solicitud import pedir_exportacion
from apps.reportes.domain.value_objects.condicion_trabajador import (
    CONDICION_PASIVO,
    normalizar_condicion,
)
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from apps.reportes.presentation.serializers.reportes_serializers import ResultadoReporteSerializer


def _respuesta_pdf(pdf_bytes: bytes, nombre_archivo: str, metadatos: dict | None = None) -> HttpResponse:
    respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    _cabeceras_de_metadatos(respuesta, metadatos)
    return respuesta


def _respuesta_excel(excel_bytes: bytes, nombre_archivo: str, metadatos: dict | None = None) -> HttpResponse:
    respuesta = HttpResponse(
        excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    respuesta['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    _cabeceras_de_metadatos(respuesta, metadatos)
    return respuesta


def _cabeceras_de_metadatos(respuesta: HttpResponse, metadatos: dict | None) -> None:
    """Expone el tamaño del resultado al frontend (aviso de tope de filas)."""
    if not metadatos:
        return
    aplicar_cabeceras_de_truncado(
        respuesta,
        total_encontrados=metadatos.get('total_encontrados', 0),
        limite=metadatos.get('limite', 0),
        truncado=bool(metadatos.get('truncado')),
    )


def _generar_reporte_personal(request, *, para_pdf: bool):
    """Reporte de personal activo para la vista JSON (la exportación va por Celery).

    Aquí solo se cablea lo que la capa de aplicación no puede conocer: la
    decisión del permiso de estructura (motor IAM de `core`) y el tope de filas
    del formato de salida.
    """
    return generar_reporte_personal(
        RepoReportesORM(),
        # `.dict()`: un valor escalar por clave (con `dict(query_params)` cada
        # valor llegaría como lista y la validación de tipos lo rechazaría).
        filtros=request.query_params.dict(),
        registro=ReportFieldRegistryORM(),
        puede_filtrar_estructura=usuario_tiene_permiso(
            request.user, PERMISO_ESTRUCTURA_ORGANIZATIVA
        ),
        limite=limite_de_reporte(para_pdf=para_pdf),
    )


def _pedir_exportacion_familiares(request, formato: str):
    """Familiares de ACTIVOS (por defecto) o de PASIVOS según `condicion` (validada)."""
    condicion = normalizar_condicion(request.query_params.get('condicion'))
    tipo = 'familiares_pasivos' if condicion == CONDICION_PASIVO else 'familiares_activos'
    # `condicion` no es un filtro del registro: se resuelve aquí y no viaja en los filtros.
    return pedir_exportacion(request, tipo=tipo, formato=formato, quitar_filtros=('condicion',))


class ReportePersonalActivoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER_REPORTES)]

    @extend_schema(tags=['Reportes'], summary='Generar reporte consolidado de personal activo', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        dto = _generar_reporte_personal(request, para_pdf=False)
        return ok(ResultadoReporteSerializer(dto).data)


class ReportePersonalActivoPdfView(APIView):
    """GET /api/v1/reportes/personal-activo/pdf/ — encola la exportación y responde 202."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Exportar el reporte de personal activo en PDF (asíncrono)', responses={202: TrabajoExportacionSerializer})
    def get(self, request):
        return pedir_exportacion(request, tipo='personal_activo', formato='pdf')


class ReportePersonalActivoExcelView(APIView):
    """GET /api/v1/reportes/personal-activo/excel/ — encola la exportación y responde 202."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Exportar el reporte de personal activo en Excel (asíncrono)', responses={202: TrabajoExportacionSerializer})
    def get(self, request):
        return pedir_exportacion(request, tipo='personal_activo', formato='excel')


class ReportePasivosView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER_REPORTES)]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de personal pasivo y egresados', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        filtros = request.query_params.dict()
        dto = generar_reporte_pasivos_actuales(
            RepoReportesORM(),
            filtros=filtros,
            registro=ReportFieldRegistryORM(),
            puede_filtrar_estructura=usuario_tiene_permiso(
                request.user, PERMISO_ESTRUCTURA_ORGANIZATIVA
            ),
            limite=limite_de_reporte(para_pdf=False),
        )
        return ok(ResultadoReporteSerializer(dto).data)


class ReportePasivosPdfView(APIView):
    """GET /api/v1/reportes/pasivos/pdf/ — encola la exportación y responde 202."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Exportar el reporte de pasivos en PDF (asíncrono)', responses={202: TrabajoExportacionSerializer})
    def get(self, request):
        return pedir_exportacion(request, tipo='pasivos', formato='pdf')


class ReportePasivosExcelView(APIView):
    """GET /api/v1/reportes/pasivos/excel/ — encola la exportación y responde 202."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Exportar el reporte de pasivos en Excel (asíncrono)', responses={202: TrabajoExportacionSerializer})
    def get(self, request):
        return pedir_exportacion(request, tipo='pasivos', formato='excel')


class ReporteVacantesView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER_REPORTES)]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de cargos vacantes', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        dto = generar_reporte_vacantes(
            RepoReportesORM(), limite=limite_de_reporte(para_pdf=False)
        )
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteVacantesPdfView(APIView):
    """GET /api/v1/reportes/cargos-vacantes/pdf/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de cargos vacantes en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        dto = generar_reporte_vacantes(
            RepoReportesORM(), limite=limite_de_reporte(para_pdf=True)
        )
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas, config=construir_config_pdf())
        return _respuesta_pdf(pdf_bytes, 'reporte_cargos_vacantes.pdf', dto.metadatos)


class ReporteVacantesExcelView(APIView):
    """GET /api/v1/reportes/cargos-vacantes/excel/ — Fase 2.4 del plan de reparación."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de cargos vacantes en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        dto = generar_reporte_vacantes(
            RepoReportesORM(), limite=limite_de_reporte(para_pdf=False)
        )
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_cargos_vacantes.xlsx', dto.metadatos)


class ReporteFamiliaresView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER_REPORTES)]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de familiares (cargas familiares) de trabajadores activos o pasivos', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        filtros = request.query_params.dict()
        condicion = normalizar_condicion(filtros.pop('condicion', None))
        dto = generar_reporte_familiares(
            RepoReportesORM(),
            filtros=filtros,
            limite=limite_de_reporte(para_pdf=False),
            condicion=condicion,
            registro=ReportFieldRegistryORM(),
            puede_filtrar_estructura=usuario_tiene_permiso(
                request.user, PERMISO_ESTRUCTURA_ORGANIZATIVA
            ),
        )
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteFamiliaresPdfView(APIView):
    """GET /api/v1/reportes/familiares/pdf/ — encola la exportación y responde 202.

    `condicion` (ACTIVO por defecto, o PASIVO) decide de qué trabajadores se
    listan los familiares; Pasivos usa la misma vista con `condicion=PASIVO`.
    """

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Exportar el reporte de familiares en PDF (asíncrono)', responses={202: TrabajoExportacionSerializer})
    def get(self, request):
        return _pedir_exportacion_familiares(request, 'pdf')


class ReporteFamiliaresExcelView(APIView):
    """GET /api/v1/reportes/familiares/excel/ — encola la exportación y responde 202.

    `condicion` (ACTIVO por defecto, o PASIVO) decide de qué trabajadores se
    listan los familiares; Pasivos usa la misma vista con `condicion=PASIVO`.
    """

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Exportar el reporte de familiares en EXCEL (asíncrono)', responses={202: TrabajoExportacionSerializer})
    def get(self, request):
        return _pedir_exportacion_familiares(request, 'excel')


class ReporteCodigosView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER_REPORTES)]

    @extend_schema(tags=['Reportes'], summary='Generar reporte de códigos de cargo (asignaciones)', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        dto = generar_reporte_codigos(
            RepoReportesORM(),
            filtros=request.query_params.dict(),
            limite=limite_de_reporte(para_pdf=False),
        )
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteCodigosPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de códigos de cargo en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        dto = generar_reporte_codigos(
            RepoReportesORM(),
            filtros=request.query_params.dict(),
            limite=limite_de_reporte(para_pdf=True),
        )
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas, config=construir_config_pdf())
        return _respuesta_pdf(pdf_bytes, 'reporte_codigos.pdf', dto.metadatos)


class ReporteCodigosExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Descargar el reporte de códigos de cargo en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        dto = generar_reporte_codigos(
            RepoReportesORM(),
            filtros=request.query_params.dict(),
            limite=limite_de_reporte(para_pdf=False),
        )
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_codigos.xlsx', dto.metadatos)


class ReporteTendenciasView(APIView):
    """GET /api/v1/reportes/tendencias/ — series mensuales de ingresos/egresos
    de personal (últimos 12 meses) para gráficas de tendencia del frontend."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_ESTADISTICAS)]

    @extend_schema(tags=['Reportes'], summary='Tendencia mensual de ingresos y egresos de personal', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_tendencias(repo)
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteTendenciasPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Descargar la tendencia de personal en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_tendencias(repo)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas, config=construir_config_pdf())
        return _respuesta_pdf(pdf_bytes, 'reporte_tendencias.pdf')


class ReporteTendenciasExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Descargar la tendencia de personal en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_tendencias(repo)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_tendencias.xlsx')


class ReporteDistribucionNominaView(APIView):
    """GET /api/v1/reportes/distribucion-nomina/ — conteo de personal activo
    (asignaciones con empleado, sin vacantes) agrupado por tipo de nómina,
    para la gráfica de distribución del frontend."""

    permission_classes = [IsAuthenticated, HasPermission(PERMISO_ESTADISTICAS)]

    @extend_schema(tags=['Reportes'], summary='Distribución de personal activo por tipo de nómina', responses={200: ResultadoReporteSerializer})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_distribucion_nomina(repo)
        return ok(ResultadoReporteSerializer(dto).data)


class ReporteDistribucionNominaPdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_PDF)]

    @extend_schema(tags=['Reportes'], summary='Descargar la distribución por tipo de nómina en PDF', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_distribucion_nomina(repo)
        pdf_bytes = generar_reporte_pdf(dto.titulo, dto.columnas, dto.filas, config=construir_config_pdf())
        return _respuesta_pdf(pdf_bytes, 'reporte_distribucion_nomina.pdf')


class ReporteDistribucionNominaExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_GENERAR_EXCEL)]

    @extend_schema(tags=['Reportes'], summary='Descargar la distribución por tipo de nómina en Excel', responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        repo = RepoReportesORM()
        dto = generar_reporte_distribucion_nomina(repo)
        excel_bytes = generar_reporte_excel(dto.titulo, dto.columnas, dto.filas)
        return _respuesta_excel(excel_bytes, 'reporte_distribucion_nomina.xlsx')
