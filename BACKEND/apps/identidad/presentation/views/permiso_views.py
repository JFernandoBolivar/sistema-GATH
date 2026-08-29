"""
Vistas del módulo identidad (B3.1).

Vistas delgadas (regla B7): validan entrada mínima, invocan casos de uso con
el repositorio ORM y responden por el sobre C-1 (`ok()`/`fail()`, regla B9).
Ningún acceso al ORM aquí.
"""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

from apps.identidad.application.use_cases.listar_permisos import (
    listar_permisos,
)
from apps.identidad.application.use_cases.obtener_permisos_de_cuenta import (
    obtener_permisos_de_cuenta,
)
from apps.identidad.infrastructure.repositories.repo_permisos_orm import (
    RepoPermisosORM,
)
from apps.identidad.infrastructure.serializers.permiso_lectura_serializers import (
    PermisoLecturaSerializer,
    PermisosEfectivosSerializer,
)
from apps.identidad.presentation.filters.permiso_filters import filtrar_permisos
from apps.identidad.presentation.permissions.identidad_permissions import (
    PERMISO_CONSULTAR_PERMISOS_CUENTA,
    PERMISO_LISTAR_PERMISOS,
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
