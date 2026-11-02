"""
Vistas del catálogo de roles (CRUD, cierra CRIT-12).

El legado histórico (`USER/views/rol_views.py`) solo exigía `IsAuthenticated`
en `crear_rol`/`actualizar_rol`/`eliminar_rol` — cualquier cuenta autenticada,
sin importar su rol, podía dar de alta o eliminar roles del sistema. Aquí el
cierre real es el permiso administrativo por código (`identidad.crear_roles`/
`identidad.editar_roles`/`identidad.eliminar_roles`, C-3) en vez de la mera
autenticación.
"""
from drf_spectacular.utils import extend_schema
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated

from apps.identidad.application.dtos.rol_dto import ActualizarRolDTO, CrearRolDTO
from apps.identidad.application.use_cases.actualizar_rol import actualizar_rol
from apps.identidad.application.use_cases.crear_rol import crear_rol
from apps.identidad.application.use_cases.eliminar_rol import eliminar_rol
from apps.identidad.application.use_cases.listar_roles import listar_roles
from apps.identidad.infrastructure.repositories.repo_roles_orm import RepoRolesORM
from apps.identidad.infrastructure.serializers.rol_catalogo_serializers import (
    RolCatalogoEscrituraSerializer,
    RolCatalogoLecturaSerializer,
)
from apps.identidad.presentation.permissions.identidad_permissions import (
    PERMISO_CREAR_ROLES,
    PERMISO_EDITAR_ROLES,
    PERMISO_ELIMINAR_ROLES,
    PERMISO_VER_ROLES,
)
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

AVISO_FRONTEND = (
    'El rol quedó creado. Recuerde incluirlo donde el frontend enumere los '
    'roles disponibles para que sea seleccionable en los formularios.'
)


class RolListCrearView(views.APIView):
    """GET/POST /api/v1/identidad/roles/ — catálogo de roles y su alta.

    Porta también `list_rols` (`USER/views/user_views.py`, hoy `AllowAny`):
    aquí exige sesión + `identidad.ver_roles` en vez de quedar público.
    """

    def get_permissions(self):
        codigo = PERMISO_VER_ROLES if self.request.method == 'GET' else PERMISO_CREAR_ROLES
        return [IsAuthenticated(), codigo()]

    @extend_schema(
        tags=['Identidad'],
        summary='Lista el catálogo de roles',
        responses={200: RolCatalogoLecturaSerializer(many=True), 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        roles = listar_roles(RepoRolesORM())
        datos = RolCatalogoLecturaSerializer(roles, many=True).data
        return ok(datos, f'{len(datos)} rol(es) encontrado(s).')

    @extend_schema(
        tags=['Identidad'],
        summary='Crea un rol en el catálogo',
        request=RolCatalogoEscrituraSerializer,
        responses={
            201: RolCatalogoLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def post(self, request):
        serializer = RolCatalogoEscrituraSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        rol = crear_rol(
            RepoRolesORM(),
            CrearRolDTO(
                nombre=datos.get('nombre_rol', ''),
                descripcion=datos.get('descripcion_rol', ''),
            ),
        )
        return ok(
            RolCatalogoLecturaSerializer(rol).data,
            AVISO_FRONTEND,
            status=status.HTTP_201_CREATED,
        )


class RolActualizarView(views.APIView):
    """PATCH /api/v1/identidad/roles/{id}/ — edición de nombre/descripción."""

    permission_classes = [IsAuthenticated, PERMISO_EDITAR_ROLES]

    @extend_schema(
        tags=['Identidad'],
        summary='Actualiza un rol del catálogo',
        request=RolCatalogoEscrituraSerializer,
        responses={
            200: RolCatalogoLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def patch(self, request, id: int):
        serializer = RolCatalogoEscrituraSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        rol = actualizar_rol(
            RepoRolesORM(),
            ActualizarRolDTO(
                id=id,
                nombre=datos.get('nombre_rol') if 'nombre_rol' in request.data else None,
                descripcion=(
                    datos.get('descripcion_rol') if 'descripcion_rol' in request.data else None
                ),
            ),
        )
        return ok(RolCatalogoLecturaSerializer(rol).data, 'Rol actualizado correctamente.')


class RolEliminarView(views.APIView):
    """DELETE /api/v1/identidad/roles/{id}/ — baja de un rol (409 si está en uso)."""

    permission_classes = [IsAuthenticated, PERMISO_ELIMINAR_ROLES]

    @extend_schema(
        tags=['Identidad'],
        summary='Elimina un rol del catálogo',
        responses={
            200: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def delete(self, request, id: int):
        eliminar_rol(RepoRolesORM(), id)
        return ok(message='Rol eliminado correctamente.')
