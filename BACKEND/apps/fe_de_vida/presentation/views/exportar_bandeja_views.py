"""Exportación asíncrona de la bandeja de fe de vida (O23), con sus filtros activos."""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView

from apps.exportaciones.domain.value_objects.tipos_exportacion import TIPO_FE_DE_VIDA_BANDEJA
from apps.exportaciones.presentation.solicitud import pedir_exportacion
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import ExportarBandejaSerializer
from apps.fe_de_vida.presentation.views._comun import validar_entrada
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Bienestar']


class ExportarBandejaView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR, permisos.VER_PANEL)

    @extend_schema(
        tags=TAG, summary='Exportación asíncrona (PDF/Excel) de la bandeja con los filtros activos',
        description=(
            'Responde 202 con el trabajo de exportación; el navegador consulta `/api/v1/exportaciones/{id}/`. '
            'Columnas: cédula, nombres, apellidos, correo, teléfono, estatus, fecha de envío y número de acta '
            '(constancia FV-AAAA-NNNNNN, vacío si no tiene).'
        ),
        parameters=[
            OpenApiParameter('formato', str, description='pdf o excel.'),
            OpenApiParameter('texto', str, description='Cédula o nombre.'),
            OpenApiParameter('estado', str), OpenApiParameter('proceso_id', str),
            OpenApiParameter('desde', str), OpenApiParameter('hasta', str),
            OpenApiParameter('historico', bool, description='true: procesos cerrados.'),
        ],
        responses={202: None, 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        datos = validar_entrada(ExportarBandejaSerializer, request.query_params)
        return pedir_exportacion(
            request, tipo=TIPO_FE_DE_VIDA_BANDEJA, formato=datos.get('formato') or 'excel',
            quitar_filtros=('formato',),
        )
