"""
Vistas de la bitácora de auditoría (D10), solo lectura.

Consulta: `auditoria.ver_logs`; exportación PDF/Excel: `auditoria.exportar`;
incidentes de seguridad: `auditoria.ver_seguridad`. Las vistas no tocan el ORM:
invocan los casos de uso y serializan. El detalle se devuelve ya saneado (sin
contraseñas, tokens ni hashes).
"""
from datetime import datetime

from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auditoria.application.use_cases.consultar_auditoria import (
    consultar_auditoria,
    consultar_incidentes,
    exportar_auditoria,
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
from apps.auditoria.infrastructure.serializers.auditoria_serializers import (
    DetalleAuditoriaSerializer,
    IncidenteSeguridadSerializer,
    OpcionesAuditoriaSerializer,
    RegistroAuditoriaSerializer,
)
from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf
from core.infrastructure.reportes import limite_de_reporte
from core.presentation.descargas import aplicar_cabeceras_de_truncado
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission

_PERMISO_VER = HasPermission(PERMISO_VER_LOGS)
_PERMISO_EXPORTAR = HasPermission(PERMISO_EXPORTAR)
_PERMISO_SEGURIDAD = HasPermission(PERMISO_VER_SEGURIDAD)

_COLUMNAS = [
    '#', 'fecha', 'usuario', 'rol', 'accion', 'modulo',
    'recurso', 'ip', 'dispositivo', 'resultado',
]
_MENSAJE_TRUNCADO = 'Resultado truncado al tope de filas; aplique más filtros.'

def _fecha_legible(valor: str) -> str:
    try:
        return datetime.fromisoformat(valor).strftime('%d/%m/%Y %H:%M:%S')
    except (TypeError, ValueError):
        return valor


def _filas(registros) -> list[dict]:
    return [
        {
            '#': indice + 1,
            'fecha': _fecha_legible(r.fecha_hora),
            'usuario': f'{r.actor_cedula} {r.actor_nombre}'.strip() or '—',
            'rol': r.actor_rol or '—',
            'accion': r.accion,
            'modulo': r.modulo,
            'recurso': f'{r.recurso_tipo}#{r.recurso_id}'.strip('#') or '—',
            'ip': r.ip or '—',
            'dispositivo': r.user_agent or '—',
            'resultado': r.resultado,
        }
        for indice, r in enumerate(registros)
    ]


def _respuesta_pdf(pdf: bytes, documento) -> HttpResponse:
    respuesta = HttpResponse(pdf, content_type='application/pdf')
    respuesta['Content-Disposition'] = 'inline; filename="bitacora-auditoria.pdf"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    aplicar_cabeceras_de_truncado(
        respuesta,
        total_encontrados=documento.total_encontrados,
        limite=documento.limite,
        truncado=documento.truncado,
    )
    return respuesta


def _respuesta_excel(excel: bytes, documento) -> HttpResponse:
    respuesta = HttpResponse(
        excel,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    respuesta['Content-Disposition'] = 'attachment; filename="bitacora-auditoria.xlsx"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    aplicar_cabeceras_de_truncado(
        respuesta,
        total_encontrados=documento.total_encontrados,
        limite=documento.limite,
        truncado=documento.truncado,
    )
    return respuesta


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

    @extend_schema(tags=['Auditoría'], summary='Exportar la bitácora a PDF con los filtros aplicados')
    def get(self, request):
        filtros = FiltrosAuditoria.desde_parametros(request.query_params.dict())
        documento = exportar_auditoria(
            RepoAuditoriaORM(), filtros, limite_de_reporte(para_pdf=True)
        )
        pdf = generar_reporte_pdf(
            'Bitácora de auditoría',
            _COLUMNAS,
            _filas(documento.registros),
            filtros=documento.filtros,
        )
        return _respuesta_pdf(pdf, documento)


class AuditoriaExcelView(APIView):
    permission_classes = [IsAuthenticated, _PERMISO_EXPORTAR]

    @extend_schema(tags=['Auditoría'], summary='Exportar la bitácora a Excel con los filtros aplicados')
    def get(self, request):
        filtros = FiltrosAuditoria.desde_parametros(request.query_params.dict())
        documento = exportar_auditoria(
            RepoAuditoriaORM(), filtros, limite_de_reporte(para_pdf=False)
        )
        excel = generar_reporte_excel(
            'Bitácora de auditoría',
            _COLUMNAS,
            _filas(documento.registros),
            filtros=documento.filtros,
        )
        return _respuesta_excel(excel, documento)


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
