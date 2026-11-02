"""
Vistas delgadas de los parámetros del sistema (D9).

- `GET /api/v1/configuracion/parametros/`: listado agrupable por tema.
- `PUT /api/v1/configuracion/parametros/<clave>/`: edición con `configuracion.editar`,
  validación en el dominio y registro en `AuditoriaLog` (valor anterior y nuevo).
- `GET /api/v1/configuracion/parametros/<clave>/historial/`: últimos cambios paginados.
- `GET /api/v1/configuracion/parametros/recordatorios-fe-de-vida/`: días sugeridos
  que consume el formulario de procesos de fe de vida (solo lectura autenticada).
"""
import uuid

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.configuracion.application.use_cases.gestionar_parametros import (
    actualizar_parametro,
    historial_parametro,
    listar_parametros,
)
from apps.configuracion.domain.parametros import (
    ACCION_PARAMETRO_ACTUALIZADO,
    DEFINICIONES_POR_CLAVE,
    MODULO_AUDITORIA,
    RECURSO_AUDITORIA,
)
from apps.configuracion.domain.value_objects.paginacion import Paginacion
from apps.configuracion.infrastructure.repositories.repo_parametros_orm import RepoParametrosORM
from apps.configuracion.infrastructure.serializers.parametros_serializers import (
    CambioParametroSerializer,
    ParametroActualizarSerializer,
    ParametroSerializer,
)
from core.domain.configuracion import (
    CLAVE_FE_DE_VIDA_RECORDATORIOS,
    como_dias,
)
from core.infrastructure.providers import obtener_lector_configuracion
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

PERMISO_CONFIGURACION = 'configuracion.editar'


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': str(getattr(user, 'cedula_id', '') or ''),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


class ParametrosView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_CONFIGURACION)]

    @extend_schema(
        tags=['Configuración'],
        summary='Listar los parámetros del sistema',
        responses={200: ParametroSerializer(many=True)},
    )
    def get(self, request):
        parametros = listar_parametros(RepoParametrosORM())
        return ok(ParametroSerializer(parametros, many=True).data)


class ParametroView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_CONFIGURACION)]

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar un parámetro del sistema (aplica sin reiniciar)',
        request=ParametroActualizarSerializer,
        responses={200: ParametroSerializer, 400: MensajeRespuestaSerializer},
    )
    def put(self, request, clave: str):
        serializer = ParametroActualizarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Guardado + auditoría en una sola transacción: si la auditoría falla,
        # el parámetro no queda cambiado.
        with transaction.atomic():
            anterior, parametro = actualizar_parametro(
                RepoParametrosORM(),
                clave,
                serializer.validated_data['valor'],
                actor_id=getattr(request.user, 'pk', None),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PARAMETRO_ACTUALIZADO,
                modulo=MODULO_AUDITORIA,
                recurso_tipo=RECURSO_AUDITORIA,
                recurso_id=clave,
                estado_previo={'valor': anterior},
                estado_nuevo={'valor': parametro.valor},
                **_actor(request),
                **origen_de_peticion(request),
            )
        return ok(ParametroSerializer(parametro).data, 'Parámetro actualizado correctamente.')


class ParametroHistorialView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_CONFIGURACION)]

    @extend_schema(
        tags=['Configuración'],
        summary='Historial de cambios de un parámetro (paginado)',
        responses={200: CambioParametroSerializer(many=True)},
    )
    def get(self, request, clave: str):
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        cambios, total = historial_parametro(RepoParametrosORM(), clave, paginacion)
        return ok({
            'resultados': CambioParametroSerializer(cambios, many=True).data,
            'total': total,
            'pagina': paginacion.pagina,
            'tamano': paginacion.tamano,
            'total_paginas': max(1, -(-total // paginacion.tamano)),
        })


class RecordatoriosFeDeVidaView(APIView):
    """Valor de solo lectura que consume el formulario de procesos de fe de vida."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Configuración'],
        summary='Días de recordatorio sugeridos para los procesos de fe de vida',
    )
    def get(self, request):
        lector = obtener_lector_configuracion()
        if lector is not None:
            texto = lector.obtener_texto(CLAVE_FE_DE_VIDA_RECORDATORIOS)
        else:
            texto = DEFINICIONES_POR_CLAVE[CLAVE_FE_DE_VIDA_RECORDATORIOS].defecto
        return ok({'dias': list(como_dias(texto))})
