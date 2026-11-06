"""Estadísticas de fe de vida para Bienestar Social (O21): pantalla, listados y exportaciones."""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView

from apps.exportaciones.domain.value_objects.tipos_exportacion import TIPO_FE_DE_VIDA_ESTADISTICAS
from apps.exportaciones.presentation.solicitud import pedir_exportacion
from apps.fe_de_vida.application.use_cases.estadisticas import (
    calcular_estadisticas,
    listar_pasivos_estadistica,
    normalizar_filtros,
)
from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM
from apps.fe_de_vida.infrastructure.repositories.repo_estadisticas_orm import RepoEstadisticasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.exportacion_estadisticas import validar_imagenes_graficos
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    EstadisticasSerializer,
    ExportarEstadisticasSerializer,
    FiltroEstadisticasSerializer,
    PasivoEstadisticaSerializer,
    a_dict_estadisticas,
    a_dict_pasivo_estadistica,
)
from apps.fe_de_vida.presentation.views._comun import (
    RECURSO_ESTADISTICAS,
    auditar,
    parametros_pagina,
    respuesta_pagina,
    validar_entrada,
)
from core.domain.exceptions import ValidationError
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Estadísticas']
PARAMETROS_FILTRO = [
    OpenApiParameter('proceso_id', str, description='Por defecto, el proceso ABIERTO más reciente.'),
    OpenApiParameter('tipo_nomina_id', int, description='Tipo de pasivo (TipoNomina).'),
    OpenApiParameter('estado', str, description='Estado de la solicitud.'),
    OpenApiParameter('canal', str, description='EN_LINEA o PRESENCIAL.'),
    OpenApiParameter('desde', str, description='Fecha de envío desde (AAAA-MM-DD).'),
    OpenApiParameter('hasta', str, description='Fecha de envío hasta (AAAA-MM-DD).'),
]


class EstadisticasView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VER_ESTADISTICAS)

    @extend_schema(
        tags=TAG, summary='KPIs, desgloses por tipo/estado/canal y matriz tipo × estado',
        description=(
            'Universo: pasivos obligados del proceso (asignación PASIVO y alcance de tipos de nómina). '
            'Respondieron = enviaron su solicitud; faltan = sin envío (incluye borradores). '
            'Los KPI son del proceso y tipo elegidos; estado, canal y fechas refinan los desgloses.'
        ),
        parameters=[*PARAMETROS_FILTRO],
        responses={200: EstadisticasSerializer, 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroEstadisticasSerializer, request.query_params)
        estadisticas = calcular_estadisticas(
            RepoEstadisticasORM(), RepoProcesosORM(), LectorAlcanceORM(),
            filtro=normalizar_filtros(request.query_params),
        )
        auditar(
            request, 'ESTADISTICAS_CONSULTADAS', getattr(estadisticas.proceso, 'id', '') or '',
            None, {
                'proceso': getattr(estadisticas.proceso, 'nombre', ''),
                'total': estadisticas.conteos.total,
                'respondieron': estadisticas.conteos.respondieron,
                'faltan': estadisticas.conteos.faltan,
            },
            recurso_tipo=RECURSO_ESTADISTICAS,
        )
        return ok(a_dict_estadisticas(estadisticas))


class PasivosEstadisticaView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VER_ESTADISTICAS)

    @extend_schema(
        tags=TAG, summary='Listado paginado del detalle: faltan por responder o una casilla de la matriz',
        description='`faltantes=true` para quienes no han enviado; si no, exige `estado` (y opcionalmente el tipo).',
        parameters=[
            OpenApiParameter('faltantes', bool, description='true: pasivos sin solicitud enviada.'),
            *PARAMETROS_FILTRO,
            OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'), OpenApiParameter('offset', int),
        ],
        responses={200: PasivoEstadisticaSerializer(many=True), 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroEstadisticasSerializer, request.query_params)
        faltantes = str(request.query_params.get('faltantes', '')).lower() in ('1', 'true', 'si', 'sí')
        if not faltantes and not filtros.get('estado'):
            raise ValidationError('Indique el estado de la casilla o marque faltantes=true.', campo='estado')
        limite, desplazamiento = parametros_pagina(filtros)
        filas, total = listar_pasivos_estadistica(
            RepoEstadisticasORM(), RepoProcesosORM(),
            filtro=normalizar_filtros(request.query_params),
            faltantes=faltantes, limite=limite, desplazamiento=desplazamiento,
        )
        auditar(
            request, 'ESTADISTICAS_LISTADO_CONSULTADO', getattr(filtros.get('proceso_id'), 'hex', '') or '',
            None, {'faltantes': faltantes, 'resultados': total}, recurso_tipo=RECURSO_ESTADISTICAS,
        )
        return ok(respuesta_pagina(total, filtros, [a_dict_pasivo_estadistica(p) for p in filas]))


class ExportarEstadisticasView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VER_ESTADISTICAS)

    @extend_schema(
        tags=TAG, summary='Exportación asíncrona (PDF/Excel) de los faltantes o de una casilla de la matriz',
        description=(
            'Responde 202 con el trabajo de exportación; el navegador consulta `/api/v1/exportaciones/{id}/`. '
            '`listado=faltantes` (por defecto) o `listado=celda` con `estado` y, opcionalmente, `tipo_nomina_id`.'
        ),
        parameters=[
            OpenApiParameter('formato', str, description='pdf o excel.'),
            OpenApiParameter('listado', str, description='faltantes o celda.'),
            *PARAMETROS_FILTRO,
        ],
        responses={202: None, 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        validar_entrada(ExportarEstadisticasSerializer, request.query_params)
        formato = (request.query_params.get('formato') or 'excel').lower()
        return pedir_exportacion(
            request, tipo=TIPO_FE_DE_VIDA_ESTADISTICAS, formato=formato,
            quitar_filtros=('formato',),
        )

    @extend_schema(
        tags=TAG, summary='Exportación con los gráficos PNG capturados de la pantalla',
        description='Mismo contrato que el GET; el cuerpo JSON trae `imagenes: [{nombre, data}]` (máx. 4).',
        request=None,
        responses={202: None, 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def post(self, request):
        validar_entrada(ExportarEstadisticasSerializer, request.query_params)
        formato = (request.query_params.get('formato') or 'excel').lower()
        imagenes = validar_imagenes_graficos(request.data.get('imagenes'))
        return pedir_exportacion(
            request, tipo=TIPO_FE_DE_VIDA_ESTADISTICAS, formato=formato,
            extra={'imagenes': imagenes} if imagenes else None,
            quitar_filtros=('formato',),
        )
