"""
Vistas U2: restablecimiento de acceso (clave inicial) en bloque.

Solo el superadministrador (permiso de Parámetros + `SUPERADMIN_CEDULA`).
La vista previa es asíncrona (202 + `task_id`): calcula el total y deja la lista
de `cuenta_id` en caché 30 min. La ejecución reutiliza esa lista y exige que
`confirmacion` sea su longitud; el estado se consulta con el mismo endpoint.
"""
from celery.result import AsyncResult
from django.core.cache import cache
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.infrastructure.tasks.restablecer_acceso_bloque_tasks import (
    CANDADO,
    clave_preview,
    restablecer_acceso_en_bloque_tarea,
    restablecimiento_bloque_preview_tarea,
)
from apps.identidad.presentation.permissions.identidad_permissions import (
    EsSuperadministrador,
)
from apps.identidad.presentation.serializers.restablecer_acceso_bloque_serializers import (
    EjecutarRestablecimientoBloqueSerializer,
    EstadoRestablecimientoBloqueSerializer,
    RestablecerAccesoBloqueSerializer,
    ResultadoRestablecimientoBloqueSerializer,
)
from core.domain.exceptions import ConflictError
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission

PERMISO = 'configuracion.editar'
PERMISOS = [IsAuthenticated, HasPermission(PERMISO), EsSuperadministrador]
TAG = 'Identidad · Restablecimiento en bloque'


def _actor_sesion(request) -> ActorSesionDTO:
    user = request.user
    return ActorSesionDTO(
        cuenta_id=getattr(user, 'pk', None),
        rol_id=getattr(user, 'rol_id', None),
        cedula=str(getattr(user, 'cedula_id', '') or '') or None,
    )


def _dict_actor(request) -> dict:
    actor = _actor_sesion(request)
    return {'cuenta_id': actor.cuenta_id, 'rol_id': actor.rol_id, 'cedula': actor.cedula}


class RestablecerAccesoBloquePreviewView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Vista previa asíncrona del restablecimiento en bloque',
        description=(
            'Encola el cálculo (comprobar la clave de cada cuenta es lento). Responde 202 con el '
            '`task_id`; el estado se consulta en el endpoint de estado. Al terminar deja la lista de '
            'cuentas en caché 30 minutos para la ejecución.'
        ),
        request=RestablecerAccesoBloqueSerializer,
        responses={202: EstadoRestablecimientoBloqueSerializer},
    )
    def post(self, request):
        serializer = RestablecerAccesoBloqueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        tarea = restablecimiento_bloque_preview_tarea.delay(
            datos['clasificacion'],
            datos['alcance'],
            datos['enviar_correo'],
            datos['motivo'],
            _dict_actor(request),
        )
        return ok(
            {'task_id': tarea.id, 'estado': 'EN_PROCESO'},
            'Cálculo de la vista previa en curso.', status=202,
        )


class RestablecerAccesoBloqueEjecutarView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Ejecutar el restablecimiento de acceso en bloque',
        description=(
            'Reutiliza la lista de cuentas de la vista previa. `confirmacion` debe ser igual a la '
            'longitud de esa lista; si no hay vista previa vigente o el número no coincide, 409.'
        ),
        request=EjecutarRestablecimientoBloqueSerializer,
        responses={202: EstadoRestablecimientoBloqueSerializer, 409: None},
    )
    def post(self, request):
        serializer = EjecutarRestablecimientoBloqueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        clave = clave_preview(
            getattr(request.user, 'pk', None), datos['clasificacion'], datos['alcance'],
        )
        cuenta_ids = cache.get(clave)
        if cuenta_ids is None:
            raise ConflictError(
                'No hay una vista previa vigente: calcúlela y confirme el número que muestre.'
            )
        if int(datos['confirmacion']) != len(cuenta_ids):
            raise ConflictError(
                'El número no coincide con la vista previa: vuelva a calcularla.'
            )
        if cache.get(CANDADO):
            raise ConflictError('Ya hay un restablecimiento en curso. Espere a que termine.')

        tarea = restablecer_acceso_en_bloque_tarea.delay(
            datos['clasificacion'],
            datos['alcance'],
            datos['enviar_correo'],
            datos['motivo'],
            _dict_actor(request),
            int(datos['confirmacion']),
            list(cuenta_ids),
        )
        cache.delete(clave)
        return ok(
            {'task_id': tarea.id, 'estado': 'EN_PROCESO'},
            'Restablecimiento en curso.', status=202,
        )


class RestablecerAccesoBloqueEstadoView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Estado y resultado del restablecimiento en bloque',
        responses={200: EstadoRestablecimientoBloqueSerializer},
    )
    def get(self, request, task_id: str):
        resultado = AsyncResult(task_id)
        estado = {
            'PENDING': 'EN_PROCESO',
            'STARTED': 'EN_PROCESO',
            'RETRY': 'EN_PROCESO',
            'SUCCESS': 'LISTO',
            'FAILURE': 'ERROR',
            'REVOKED': 'CANCELADO',
        }.get(resultado.state, resultado.state)
        cuerpo = {'task_id': task_id, 'estado': estado}
        if resultado.state == 'SUCCESS':
            valor = resultado.result
            cuerpo['resultado'] = valor
            if isinstance(valor, dict) and valor.get('estado'):
                cuerpo['estado'] = valor['estado']
        elif resultado.state == 'FAILURE':
            cuerpo['mensaje'] = 'No se pudo completar el restablecimiento. Revise la bitácora.'
        return ok(cuerpo)
