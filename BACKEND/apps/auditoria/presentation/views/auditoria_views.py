"""
Vistas de la bitácora de auditoría (D10), solo lectura.

Consulta: `auditoria.ver_logs`; exportación PDF/Excel: `auditoria.exportar`;
incidentes de seguridad: `auditoria.ver_seguridad`. Las vistas no tocan el ORM:
invocan los casos de uso y serializan. El detalle se devuelve ya saneado (sin
contraseñas, tokens ni hashes).
"""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auditoria.application.use_cases.consultar_auditoria import (
    consultar_auditoria,
    consultar_incidentes,
    obtener_detalle,
)
from apps.auditoria.domain.value_objects.filtros_auditoria import (
    FiltrosAuditoria,
    Paginacion,
)
from apps.auditoria.domain.value_objects.permisos import (
    PERMISO_EXPORTAR,
    PERMISO_VER_LOGS,
    PERMISO_VER_SEGURIDAD,
)
from apps.auditoria.infrastructure.repositories.repo_auditoria_orm import RepoAuditoriaORM
from apps.exportaciones.presentation.serializers.exportaciones_serializers import (
    TrabajoExportacionSerializer,
)
from apps.exportaciones.presentation.solicitud import pedir_exportacion
from apps.auditoria.infrastructure.serializers.auditoria_serializers import (
    DetalleAuditoriaSerializer,
    IncidenteSeguridadSerializer,
    OpcionesAuditoriaSerializer,
    RegistroAuditoriaSerializer,
)
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission

_PERMISO_VER = HasPermission(PERMISO_VER_LOGS)
_PERMISO_EXPORTAR = HasPermission(PERMISO_EXPORTAR)
_PERMISO_SEGURIDAD = HasPermission(PERMISO_VER_SEGURIDAD)

class AuditoriaListView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(
        tags=['Auditoría'], summary='Consultar la bitácora de auditoría (paginada)',
        responses={200: RegistroAuditoriaSerializer(many=True)},
    )
    def get(self, request):
        filtros = FiltrosAuditoria.desde_parametros(request.query_params.dict())
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        pagina = consultar_auditoria(RepoAuditoriaORM(), filtros, paginacion)
        return ok({
            'resultados': RegistroAuditoriaSerializer(pagina.resultados, many=True).data,
            'total': pagina.total,
            'pagina': pagina.pagina,
            'tamano': pagina.tamano,
            'total_paginas': pagina.total_paginas,
        })


class AuditoriaOpcionesView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(
        tags=['Auditoría'], summary='Valores reales para los filtros (acción, módulo, resultado)',
        responses={200: OpcionesAuditoriaSerializer},
    )
    def get(self, request):
        return ok(OpcionesAuditoriaSerializer(RepoAuditoriaORM().opciones()).data)


class AuditoriaDetalleView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_VER]

    @extend_schema(
        tags=['Auditoría'], summary='Detalle de un registro (antes/después saneado)',
        responses={200: DetalleAuditoriaSerializer},
    )
    def get(self, request, id: str):
        detalle = obtener_detalle(RepoAuditoriaORM(), id)
        return ok(DetalleAuditoriaSerializer(detalle).data)


class AuditoriaPdfView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_EXPORTAR]

    @extend_schema(
        tags=['Auditoría'], summary='Exportar la bitácora a PDF con los filtros aplicados (asíncrono)',
        responses={202: TrabajoExportacionSerializer},
    )
    def get(self, request):
        return pedir_exportacion(request, tipo='auditoria', formato='pdf')


class AuditoriaExcelView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_EXPORTAR]

    @extend_schema(
        tags=['Auditoría'], summary='Exportar la bitácora a Excel con los filtros aplicados (asíncrono)',
        responses={202: TrabajoExportacionSerializer},
    )
    def get(self, request):
        return pedir_exportacion(request, tipo='auditoria', formato='excel')


class IncidentesSeguridadView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_SEGURIDAD]

    @extend_schema(
        tags=['Auditoría'], summary='Incidentes de seguridad del login (bloqueos)',
        responses={200: IncidenteSeguridadSerializer(many=True)},
    )
    def get(self, request):
        filtros = FiltrosAuditoria.desde_parametros(request.query_params.dict())
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        pagina = consultar_incidentes(RepoAuditoriaORM(), filtros, paginacion)
        return ok({
            **pagina,
            'resultados': IncidenteSeguridadSerializer(pagina['resultados'], many=True).data,
        })
