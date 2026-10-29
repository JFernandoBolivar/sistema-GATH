"""
Bandeja del propio usuario (campana). Zero-IDOR: la cédula SIEMPRE sale de la sesión autenticada,
nunca de la URL ni del cuerpo; una notificación ajena responde 404 igual que una inexistente.
Vistas delgadas: sin ORM (B7).
"""
from datetime import datetime, timezone

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.notificaciones.application.use_cases.gestionar_notificaciones import (
    conteo_no_leidas,
    listar_notificaciones,
    marcar_leida,
    marcar_todas_leidas,
)
from apps.notificaciones.infrastructure.cache_conteo_django import CacheConteoDjango
from apps.notificaciones.infrastructure.repositories.repo_notificaciones_orm import RepoNotificacionesORM
from apps.notificaciones.presentation.serializers.notificaciones_serializers import (
    ConteoNoLeidasSerializer,
    ListaNotificacionesSerializer,
    MarcadaLeidaSerializer,
    MarcadasLeidasSerializer,
    a_dict_notificacion,
)
from core.domain.exceptions import NotFoundError
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Notificaciones']
PERMISOS = [IsAuthenticated, HasPermission('notificaciones.ver_propias')]
ERRORES = {403: MensajeRespuestaSerializer}


def _cedula_de_sesion(request) -> str:
    cedula = getattr(request.user, 'cedula_id', None)
    if not cedula:
        raise NotFoundError('El usuario autenticado no tiene un expediente de trabajador asociado.')
    return str(cedula)


def _entero(valor, defecto: int) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return defecto


class NotificacionesView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Mis notificaciones (paginadas, más recientes primero)',
        parameters=[
            OpenApiParameter('no_leidas', bool, description='1/true: solo las no leídas'),
            OpenApiParameter('limit', int, description='Por defecto 20, máximo 100'),
            OpenApiParameter('offset', int),
        ],
        responses={200: ListaNotificacionesSerializer, **ERRORES},
    )
    def get(self, request):
        pagina, total, limite, desplazamiento = listar_notificaciones(
            RepoNotificacionesORM(), _cedula_de_sesion(request),
            solo_no_leidas=str(request.query_params.get('no_leidas', '')).lower() in ('1', 'true', 'si', 'sí'),
            limite=_entero(request.query_params.get('limit'), 20),
            desplazamiento=_entero(request.query_params.get('offset'), 0),
        )
        return ok({
            'count': total, 'limit': limite, 'offset': desplazamiento,
            'results': [a_dict_notificacion(n) for n in pagina],
        })


class ConteoNoLeidasView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Contador de no leídas (ligero, para el polling de la campana)',
        responses={200: ConteoNoLeidasSerializer, **ERRORES},
    )
    def get(self, request):
        total = conteo_no_leidas(RepoNotificacionesORM(), CacheConteoDjango(), _cedula_de_sesion(request))
        return ok({'no_leidas': total})


class LeerNotificacionView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Marcar una notificación propia como leída (idempotente)',
        request=None, responses={200: MarcadaLeidaSerializer, 404: MensajeRespuestaSerializer, **ERRORES},
    )
    def post(self, request, notificacion_id):
        marcar_leida(
            RepoNotificacionesORM(), CacheConteoDjango(), _cedula_de_sesion(request),
            str(notificacion_id), datetime.now(timezone.utc),
        )
        return ok({'id': str(notificacion_id), 'leida': True}, 'Notificación marcada como leída.')


class LeerTodasView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Marcar todas mis notificaciones como leídas',
        request=None, responses={200: MarcadasLeidasSerializer, **ERRORES},
    )
    def post(self, request):
        marcadas = marcar_todas_leidas(
            RepoNotificacionesORM(), CacheConteoDjango(), _cedula_de_sesion(request), datetime.now(timezone.utc),
        )
        return ok({'marcadas': marcadas}, 'Notificaciones marcadas como leídas.')
