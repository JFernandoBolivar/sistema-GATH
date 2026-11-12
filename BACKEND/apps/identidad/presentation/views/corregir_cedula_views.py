"""
Vistas: corregir la cédula de un trabajador (permiso `personal.corregir_cedula`, síncrono).

`POST corregir-cedula/preview/` calcula qué se tocaría; `POST corregir-cedula/` lo ejecuta en una
sola transacción. No envía correo y no modifica `auditoria_log` (solo agrega su evento).
"""
import uuid

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.identidad.application.use_cases.corregir_cedula import (
    corregir_cedula,
    previsualizar_correccion_cedula,
)
from apps.identidad.infrastructure.providers.cache_correccion_cedula import invalidar_caches_cedula
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_correccion_cedula_orm import (
    RepoCorreccionCedulaORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.presentation.serializers.corregir_cedula_serializers import (
    CorregirCedulaSerializer,
    ResultadoCorreccionSerializer,
    VistaPreviaCorreccionCedulaSerializer,
    VistaPreviaCorreccionRespuestaSerializer,
)
from apps.configuracion.domain.parametros import definicion_de
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS
from core.infrastructure.providers import obtener_lector_configuracion
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

PERMISO = 'personal.corregir_cedula'
PERMISOS = [IsAuthenticated, HasPermission(PERMISO)]
TAG = 'Identidad · Corregir cédula'
ACCION_AUDITORIA = 'identidad.cedula_corregida'
DIAS_POR_DEFECTO = int(definicion_de(CLAVE_PASSWORD_INICIAL_DIAS).defecto)

_ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer}


def _afectados(pares) -> list[dict]:
    return [{'tabla': tabla, 'registros': n} for tabla, n in pares]


def _dias_vigencia() -> int:
    lector = obtener_lector_configuracion()
    if lector is None:
        return DIAS_POR_DEFECTO
    try:
        return max(1, int(lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)))
    except (TypeError, ValueError):
        return DIAS_POR_DEFECTO


class CorregirCedulaPreviewView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Vista previa de la corrección de cédula',
        request=VistaPreviaCorreccionCedulaSerializer,
        responses={200: VistaPreviaCorreccionRespuestaSerializer, **_ERRORES},
    )
    def post(self, request):
        serializer = VistaPreviaCorreccionCedulaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        vista = previsualizar_correccion_cedula(
            RepoCorreccionCedulaORM(), RepoCondicionTrabajadorORM(), RepoCuentasORM(),
            RepoPasswordInicialORM(), datos['cedula_actual'], datos['cedula_nueva'],
        )
        return ok({
            'trabajador': {
                'cedula_actual': vista.trabajador.cedula_actual,
                'nombre': vista.trabajador.nombre,
                'condicion': vista.trabajador.condicion,
            },
            'cedula_nueva': vista.cedula_nueva,
            'cuenta': {
                'existe': vista.cuenta.existe,
                'correo': vista.cuenta.correo,
                'clave_inicial_pendiente': vista.cuenta.clave_inicial_pendiente,
            },
            'afectados': _afectados(vista.afectados),
            'total_registros': vista.total_registros,
        })


class CorregirCedulaView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Corregir la cédula de un trabajador',
        description=(
            'Reescribe la cédula en la ficha y en todas las tablas que la guardan, en una sola '
            'transacción. Si la clave sigue siendo la inicial pasa a ser la cédula nueva. Cierra '
            'las sesiones de la cuenta. No envía correo. `confirmacion` debe ser la cédula nueva.'
        ),
        request=CorregirCedulaSerializer,
        responses={200: ResultadoCorreccionSerializer, **_ERRORES},
    )
    def post(self, request):
        serializer = CorregirCedulaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        user = request.user
        trace_id = getattr(request, 'trace_id', None) or uuid.uuid4().hex
        origen = origen_de_peticion(request)

        def auditar(previo: dict, nuevo: dict) -> None:
            registrar_auditoria(
                trace_id=trace_id,
                actor_id=getattr(user, 'pk', None),
                actor_cedula=str(getattr(user, 'cedula_id', '') or ''),
                actor_rol=str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
                accion=ACCION_AUDITORIA,
                modulo='identidad',
                recurso_tipo='Trabajador',
                recurso_id=nuevo['cedula'],
                estado_previo=previo,
                estado_nuevo=nuevo,
                **origen,
            )

        resultado = corregir_cedula(
            RepoCorreccionCedulaORM(), RepoCuentasORM(), RepoPasswordInicialORM(),
            RepoPermisosVersionORM(),
            atomico=transaction.atomic,
            auditar=auditar,
            invalidar_caches=invalidar_caches_cedula,
            ahora=timezone.now(),
            dias_vigencia=_dias_vigencia(),
            cedula_actual=datos['cedula_actual'],
            cedula_nueva=datos['cedula_nueva'],
            motivo=datos['motivo'],
            confirmacion=datos['confirmacion'],
        )
        return ok({
            'cedula_anterior': resultado.cedula_anterior,
            'cedula_nueva': resultado.cedula_nueva,
            'afectados': _afectados(resultado.afectados),
            'total_registros': resultado.total_registros,
            'clave_inicial_actualizada': resultado.clave_inicial_actualizada,
        }, 'Cédula corregida.')
