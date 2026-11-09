"""
Vistas del módulo identidad (B3.1).

Vistas delgadas (regla B7): validan entrada mínima, invocan casos de uso con
el repositorio ORM y responden por el sobre C-1 (`ok()`/`fail()`, regla B9).
Ningún acceso al ORM aquí.

D4: catálogo, permiso efectivo de una cuenta, overrides individuales y matriz
rol-permiso. El permiso efectivo siempre lo calcula el servidor con el motor
IAM (`evaluar_permiso`), nunca el frontend.
"""
import uuid

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer
from core.domain.exceptions import ConflictError, PermissionDeniedError

from apps.identidad.application.dtos.administracion_dto import (
    GuardarMatrizDTO,
    GuardarOverridesDTO,
)
from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.administrar_usuarios import (
    guardar_matriz_rol,
    guardar_permisos_individuales,
    obtener_detalle_usuario,
    obtener_matriz,
)
from apps.identidad.application.use_cases.listar_permisos import (
    listar_permisos,
)
from apps.identidad.application.use_cases.obtener_permisos_de_cuenta import (
    obtener_permisos_de_cuenta,
)
from apps.identidad.domain.services.reglas_administracion import validar_matriz_propia
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_permisos_orm import (
    RepoPermisosORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.repositories.repo_roles_orm import RepoRolesORM
from apps.identidad.infrastructure.serializers.administracion_serializers import (
    GuardarMatrizSerializer,
    GuardarOverridesSerializer,
    MatrizPermisosSerializer,
    UsuarioDetalleSerializer,
)
from apps.identidad.infrastructure.serializers.permiso_lectura_serializers import (
    PermisoLecturaSerializer,
    PermisosEfectivosSerializer,
)
from apps.identidad.presentation.filters.permiso_filters import filtrar_permisos
from apps.identidad.presentation.permissions.identidad_permissions import (
    PERMISO_CONSULTAR_PERMISOS_CUENTA,
    PERMISO_EDITAR_MATRIZ,
    PERMISO_GESTIONAR_PERMISOS_INDIVIDUALES,
    PERMISO_LISTAR_PERMISOS,
    PERMISO_VER_ROLES,
)
from core.presentation.permissions import HasPermission  # noqa: F401

ACCION_OVERRIDES_ACTUALIZADOS = 'identidad.permisos_individuales_actualizados'
ACCION_MATRIZ_ACTUALIZADA = 'identidad.matriz_permisos_actualizada'
MODULO_AUDITORIA = 'identidad'
RECURSO_USUARIO = 'Usuario'
RECURSO_ROL = 'Rol'


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': str(getattr(user, 'cedula_id', '') or ''),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


def _actor_sesion(request) -> ActorSesionDTO:
    return ActorSesionDTO(
        cuenta_id=getattr(request.user, 'pk', None),
        rol_id=getattr(request.user, 'rol_id', None),
        cedula=str(getattr(request.user, 'cedula_id', '') or '') or None,
    )


def _auditar_denegado(
    request,
    *,
    accion: str,
    recurso_tipo: str,
    recurso_id: str,
    motivo: str,
    detalle: dict | None = None,
) -> None:
    """B1: el intento rechazado se registra fuera de la transacción revertida."""
    registrar_auditoria(
        trace_id=_trace(request),
        accion=accion,
        modulo=MODULO_AUDITORIA,
        recurso_tipo=recurso_tipo,
        recurso_id=recurso_id,
        resultado='DENIED',
        estado_previo=detalle or {},
        estado_nuevo={'motivo': motivo},
        **_actor(request),
        **origen_de_peticion(request),
    )


class CatalogoPermisosView(APIView):
    """GET /api/v1/identidad/permisos/ — catálogo completo de permisos."""

    permission_classes = [IsAuthenticated, PERMISO_LISTAR_PERMISOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Lista el catálogo de permisos',
        description=(
            'Devuelve todos los códigos [modulo].[accion] registrados, '
            'con filtro opcional ?texto= sobre código o nombre.'
        ),
        responses={
            200: PermisoLecturaSerializer(many=True),
            403: MensajeRespuestaSerializer,
        },
    )
    def get(self, request):
        texto = request.query_params.get('texto')
        permisos = listar_permisos(RepoPermisosORM())
        datos = PermisoLecturaSerializer(
            filtrar_permisos(permisos, texto), many=True
        ).data
        return ok(datos, f'{len(datos)} permisos encontrados.')


class PermisosDeCuentaView(APIView):
    """GET /api/v1/identidad/cuentas/{cedula}/permisos/ — códigos efectivos."""

    permission_classes = [IsAuthenticated, PERMISO_CONSULTAR_PERMISOS_CUENTA]

    @extend_schema(
        tags=['Identidad'],
        summary='Permisos efectivos de una cuenta',
        description=(
            'Resuelve los códigos efectivos de la cuenta identificada por '
            'cédula. Cuenta inexistente o sin rol devuelven lista vacía '
            '(denegación por defecto).'
        ),
        responses={
            200: PermisosEfectivosSerializer,
            403: MensajeRespuestaSerializer,
        },
    )
    def get(self, request, cedula: str):
        dto = obtener_permisos_de_cuenta(RepoPermisosORM(), cedula)
        datos = PermisosEfectivosSerializer(
            {
                'cedula': dto.cedula,
                'rol_id': dto.rol_id,
                'codigos': sorted(dto.codigos),
            }
        ).data
        return ok(datos, 'Permisos resueltos.')


class UsuarioPermisosIndividualesView(APIView):
    """PUT /api/v1/identidad/usuarios/{id}/permisos-individuales/ — overrides (D4)."""

    permission_classes = [IsAuthenticated, PERMISO_GESTIONAR_PERMISOS_INDIVIDUALES]

    @extend_schema(
        tags=['Identidad'],
        summary='Reemplaza los permisos individuales (allow/deny) de una cuenta',
        request=GuardarOverridesSerializer,
        responses={
            200: UsuarioDetalleSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def put(self, request, id: int):
        serializer = GuardarOverridesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        motivo = datos['motivo']

        repo_cuentas = RepoCuentasORM()
        repo_permisos = RepoPermisosORM()
        try:
            with transaction.atomic():
                repo_cuentas.bloquear_administracion()
                previo = obtener_detalle_usuario(
                    repo_cuentas, repo_permisos, RepoCondicionTrabajadorORM(), id
                )
                detalle = guardar_permisos_individuales(
                    repo_cuentas,
                    repo_permisos,
                    RepoCondicionTrabajadorORM(),
                    id=id,
                    actor=_actor_sesion(request),
                    datos=GuardarOverridesDTO(
                        allow=tuple(datos['allow']),
                        deny=tuple(datos['deny']),
                        motivo=motivo,
                    ),
                )
                registrar_auditoria(
                    trace_id=_trace(request),
                    accion=ACCION_OVERRIDES_ACTUALIZADOS,
                    modulo=MODULO_AUDITORIA,
                    recurso_tipo=RECURSO_USUARIO,
                    recurso_id=str(id),
                    estado_previo={
                        'allow': list(previo.permisos.allow),
                        'deny': list(previo.permisos.deny),
                    },
                    estado_nuevo={
                        'allow': list(detalle.permisos.allow),
                        'deny': list(detalle.permisos.deny),
                        'motivo': motivo,
                    },
                    **_actor(request),
                    **origen_de_peticion(request),
                )
        except (PermissionDeniedError, ConflictError) as error:
            _auditar_denegado(
                request,
                accion=ACCION_OVERRIDES_ACTUALIZADOS,
                recurso_tipo=RECURSO_USUARIO,
                recurso_id=str(id),
                motivo=motivo,
                detalle={'allow': list(datos['allow']), 'deny': list(datos['deny']),
                         'error': type(error).__name__},
            )
            raise
        return ok(
            UsuarioDetalleSerializer(
                {**detalle.cuenta.__dict__, 'permisos': detalle.permisos.__dict__}
            ).data,
            'Permisos individuales actualizados.',
        )


class MatrizPermisosView(APIView):
    """GET /api/v1/identidad/roles/matriz/ — filas por permiso y columnas por rol."""

    permission_classes = [IsAuthenticated, PERMISO_VER_ROLES]

    @extend_schema(
        tags=['Identidad'],
        summary='Matriz rol-permiso',
        responses={200: MatrizPermisosSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        matriz = obtener_matriz(RepoPermisosORM(), RepoRolesORM())
        return ok(
            MatrizPermisosSerializer(
                {
                    'filas': [f.__dict__ for f in matriz.filas],
                    'roles': [r.__dict__ for r in matriz.roles],
                }
            ).data
        )


class MatrizRolView(APIView):
    """PUT /api/v1/identidad/roles/{id}/permisos/ — edita la fila de un rol (D4)."""

    permission_classes = [IsAuthenticated, PERMISO_EDITAR_MATRIZ]

    @extend_schema(
        tags=['Identidad'],
        summary='Reemplaza los permisos de un rol',
        request=GuardarMatrizSerializer,
        responses={
            200: MatrizPermisosSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def put(self, request, id: int):
        serializer = GuardarMatrizSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        motivo = datos['motivo']

        try:
            validar_matriz_propia(
                rol_actor_id=getattr(request.user, 'rol_id', None),
                rol_objetivo_id=id,
            )
            with transaction.atomic():
                repo_cuentas = RepoCuentasORM()
                repo_cuentas.bloquear_administracion()
                antes, despues = guardar_matriz_rol(
                    repo_cuentas,
                    RepoPermisosORM(),
                    RepoRolesORM(),
                    RepoPermisosVersionORM(),
                    rol_id=id,
                    actor=_actor_sesion(request),
                    datos=GuardarMatrizDTO(
                        codigos=tuple(datos['permisos']),
                        motivo=motivo,
                    ),
                )
                if antes != despues:
                    registrar_auditoria(
                        trace_id=_trace(request),
                        accion=ACCION_MATRIZ_ACTUALIZADA,
                        modulo=MODULO_AUDITORIA,
                        recurso_tipo=RECURSO_ROL,
                        recurso_id=str(id),
                        estado_previo={'permisos': sorted(antes)},
                        estado_nuevo={
                            'permisos': sorted(despues),
                            'motivo': motivo,
                        },
                        **_actor(request),
                        **origen_de_peticion(request),
                    )
        except (PermissionDeniedError, ConflictError) as error:
            _auditar_denegado(
                request,
                accion=ACCION_MATRIZ_ACTUALIZADA,
                recurso_tipo=RECURSO_ROL,
                recurso_id=str(id),
                motivo=motivo,
                detalle={'permisos_solicitados': sorted(datos['permisos']),
                         'error': type(error).__name__},
            )
            raise
        matriz = obtener_matriz(RepoPermisosORM(), RepoRolesORM())
        return ok(
            MatrizPermisosSerializer(
                {
                    'filas': [f.__dict__ for f in matriz.filas],
                    'roles': [r.__dict__ for r in matriz.roles],
                }
            ).data,
            'Matriz de permisos actualizada.',
        )
