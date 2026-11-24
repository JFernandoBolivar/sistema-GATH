"""
Bandeja del propio usuario (campana). Zero-IDOR: la cédula SIEMPRE sale de la sesión autenticada,
nunca de la URL ni del cuerpo; una notificación ajena responde 404 igual que una inexistente.
Vistas delgadas: sin ORM (B7).
"""
from datetime import date, datetime, timezone

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.notificaciones.application.use_cases.correo_outbox import resumen_fallidos
from apps.notificaciones.application.use_cases.gestionar_notificaciones import (
    LIMITE_PREDETERMINADO,
    conteo_no_leidas,
    estado_bandeja,
    listar_notificaciones,
    marcar_leida,
    marcar_todas_leidas,
)
from apps.notificaciones.infrastructure.cache_conteo_django import CacheConteoDjango
from apps.notificaciones.infrastructure.repositories.repo_notificaciones_orm import RepoNotificacionesORM
from apps.notificaciones.infrastructure.repositories.repo_outbox_orm import RepoOutboxORM
from apps.notificaciones.presentation.serializers.notificaciones_serializers import (
    ConteoNoLeidasSerializer,
    EstadoNotificacionesSerializer,
    ListaNotificacionesSerializer,
    MarcadaLeidaSerializer,
    MarcadasLeidasSerializer,
    a_dict_notificacion,
)
from core.domain.exceptions import NotFoundError, ValidationError
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


def _fecha(valor, nombre: str) -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor))
    except ValueError:
        raise ValidationError(f'La fecha "{nombre}" debe tener formato AAAA-MM-DD.')


def _tri_estado(valor) -> bool | None:
    """sí/no/todas: cualquier otro valor (o ausente) equivale a todas."""
    v = str(valor or '').lower()
    if v in ('1', 'true', 'si', 'sí'):
        return True
    if v in ('0', 'false', 'no'):
        return False
    return None


class NotificacionesView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Mis notificaciones (paginadas, más recientes primero)',
        parameters=[
            OpenApiParameter('modulo', str, required=False, description='Opcional: filtra una bandeja (autogestion | personal | pasivos | carnetizacion | seguridad). Sin él, todas las del usuario.'),
            OpenApiParameter('no_leidas', bool, description='1/true: solo las no leídas (atajo de leida=no)'),
            OpenApiParameter('leida', str, description='si | no | vacío (todas)'),
            OpenApiParameter('q', str, description='Texto en título o mensaje (icontains, máx. 100 caracteres)'),
            OpenApiParameter('tipo', str, description='Código exacto del tipo de notificación'),
            OpenApiParameter('desde', str, description='AAAA-MM-DD, inclusive, sobre creada_en'),
            OpenApiParameter('hasta', str, description='AAAA-MM-DD, inclusive, sobre creada_en'),
            OpenApiParameter('limit', int, description='Por defecto 10, máximo 50 (se acota)'),
            OpenApiParameter('offset', int),
        ],
        responses={200: ListaNotificacionesSerializer, 400: MensajeRespuestaSerializer, **ERRORES},
    )
    def get(self, request):
        p = request.query_params
        pagina, total, limite, desplazamiento = listar_notificaciones(
            RepoNotificacionesORM(), _cedula_de_sesion(request), p.get('modulo', ''),
            solo_no_leidas=_tri_estado(p.get('no_leidas')) is True,
            limite=_entero(p.get('limit'), LIMITE_PREDETERMINADO),
            desplazamiento=_entero(p.get('offset'), 0),
            q=p.get('q', ''), tipo=p.get('tipo', ''), leida=_tri_estado(p.get('leida')),
            desde=_fecha(p.get('desde'), 'desde'), hasta=_fecha(p.get('hasta'), 'hasta'),
        )
        return ok({
            'count': total, 'limit': limite, 'offset': desplazamiento,
            'results': [a_dict_notificacion(n) for n in pagina],
        })


class ConteoNoLeidasView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Contador de no leídas del usuario (ligero, para el polling de la campana)',
        parameters=[OpenApiParameter('modulo', str, required=False, description='Opcional; sin él cuenta todas las del usuario.')],
        responses={200: ConteoNoLeidasSerializer, **ERRORES},
    )
    def get(self, request):
        total = conteo_no_leidas(RepoNotificacionesORM(), CacheConteoDjango(), _cedula_de_sesion(request), request.query_params.get('modulo', ''))
        return ok({'no_leidas': total})


def _etag_coincide(cabecera: str | None, etag: str) -> bool:
    if not cabecera:
        return False
    if cabecera.strip() == '*':
        return True
    debil = lambda v: v.strip().removeprefix('W/')  # noqa: E731
    return any(debil(c) == debil(etag) for c in cabecera.split(','))


class EstadoNotificacionesView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=TAG, summary='Estado liviano de la bandeja (sondeo casi en tiempo real, con ETag/304)',
        description='Devuelve {no_leidas, ultima_actualizacion}. Incluye la cabecera ETag; con If-None-Match igual responde 304 sin cuerpo.',
        responses={200: EstadoNotificacionesSerializer, 304: None, **ERRORES},
    )
    def get(self, request):
        datos, etag = estado_bandeja(RepoNotificacionesORM(), _cedula_de_sesion(request))
        if _etag_coincide(request.headers.get('If-None-Match'), etag):
            respuesta = ok()  # 304: sin cuerpo (B9: toda respuesta nace del sobre)
            respuesta.status_code, respuesta.data = 304, None
        else:
            respuesta = ok(datos)
        respuesta['ETag'] = etag
        respuesta['Cache-Control'] = 'private, no-cache'
        return respuesta


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
        tags=TAG, summary='Marcar todas mis notificaciones como leídas (o solo las de un módulo)',
        parameters=[OpenApiParameter('modulo', str, required=False, description='Opcional; sin él marca todas las del usuario.')],
        request=None, responses={200: MarcadasLeidasSerializer, **ERRORES},
    )
    def post(self, request):
        marcadas = marcar_todas_leidas(
            RepoNotificacionesORM(), CacheConteoDjango(), _cedula_de_sesion(request),
            request.query_params.get('modulo', ''), datetime.now(timezone.utc),
        )
        return ok({'marcadas': marcadas}, 'Notificaciones marcadas como leídas.')


class OutboxFallidosView(APIView):
    """Aviso administrativo: correos que agotaron los reintentos (E3)."""

    permission_classes = [IsAuthenticated, HasPermission('notificaciones.administrar')]

    @extend_schema(
        tags=TAG, summary='Correos salientes FALLIDOS (ultimos 5)',
        responses={200: MensajeRespuestaSerializer, **ERRORES},
    )
    def get(self, request):
        return ok(resumen_fallidos(RepoOutboxORM()))
