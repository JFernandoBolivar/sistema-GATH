"""
Vistas de presentación para Reglas de Catálogos (A5).
"""
import uuid
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.configuracion.application.use_cases.gestionar_reglas_catalogos import (
    crear_parentesco,
    editar_parentesco,
    eliminar_parentesco,
    obtener_todas_las_reglas,
)
from apps.configuracion.domain.reglas_catalogos import (
    ACCION_PARENTESCO_ACTUALIZADO,
    ACCION_PARENTESCO_CREADO,
    ACCION_PARENTESCO_ELIMINADO,
    MODULO_AUDITORIA_CONFIGURACION,
    RECURSO_REGLAS_PARENTESCO,
)
from apps.configuracion.infrastructure.repositories.repo_reglas_catalogos_orm import (
    RepoReglasCatalogosORM,
)
from apps.configuracion.infrastructure.serializers.reglas_catalogos_serializers import (
    ActualizarParentescoSerializer,
    CrearParentescoSerializer,
    ReglaParentescoSerializer,
    ReglasCatalogosCompletoSerializer,
)
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasAnyPermission
from core.presentation.schema import MensajeRespuestaSerializer

PERMISO_VER = 'configuracion.ver'
PERMISO_EDITAR = 'configuracion.editar'
PERMISO_CATALOGOS_VER = 'catalogos.ver'
PERMISO_CATALOGOS_EDITAR = 'catalogos.editar'
PERMISO_CATALOGOS_CREAR = 'catalogos.crear'


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': str(getattr(user, 'cedula_id', '') or ''),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


_REGLAS_PARENTESCO_VISTA = (
    'es_hijo', 'menor_a_cargo', 'sin_cedula_hasta_edad', 'edad_minima',
    'diferencia_minima', 'diferencia_tipo', 'sexo_permitido', 'soporte_sugerido',
    'activo',
)


def _regla_parentesco_de(serializer) -> dict | None:
    datos = {
        campo: serializer.validated_data[campo]
        for campo in _REGLAS_PARENTESCO_VISTA
        if campo in serializer.validated_data
    }
    return datos or None


class ReglasCatalogosListView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_VER, PERMISO_CATALOGOS_VER)]

    @extend_schema(
        tags=['Configuración'],
        summary='Obtener todas las reglas de catálogos (parentescos, motivos y nóminas)',
        responses={200: ReglasCatalogosCompletoSerializer},
    )
    def get(self, request):
        repo = RepoReglasCatalogosORM()
        datos = obtener_todas_las_reglas(repo)
        return ok(ReglasCatalogosCompletoSerializer(datos).data)


class ReglaParentescoUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar nombre y/o si un parentesco aplica para familiares',
        request=ActualizarParentescoSerializer,
        responses={200: ReglaParentescoSerializer, 400: MensajeRespuestaSerializer},
    )
    def patch(self, request, id: int):
        serializer = ActualizarParentescoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anterior, actualizado = editar_parentesco(
                repo,
                id,
                serializer.validated_data.get('descripcion'),
                serializer.validated_data.get('aplica_familiar'),
                regla=_regla_parentesco_de(serializer),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PARENTESCO_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PARENTESCO,
                recurso_id=str(id),
                estado_previo={
                    'aplica_familiar': anterior.aplica_familiar,
                    'descripcion': anterior.descripcion,
                    **{c: getattr(anterior, c) for c in _REGLAS_PARENTESCO_VISTA},
                },
                estado_nuevo={
                    'aplica_familiar': actualizado.aplica_familiar,
                    'descripcion': actualizado.descripcion,
                    **{c: getattr(actualizado, c) for c in _REGLAS_PARENTESCO_VISTA},
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaParentescoSerializer(actualizado).data,
            'Regla de parentesco actualizada correctamente.',
        )

    @extend_schema(
        tags=['Configuración'],
        summary='Eliminar un parentesco sin referencias (los reservados no se borran)',
        responses={200: ReglaParentescoSerializer, 400: MensajeRespuestaSerializer},
    )
    def delete(self, request, id: int):
        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            eliminado = eliminar_parentesco(repo, id)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PARENTESCO_ELIMINADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PARENTESCO,
                recurso_id=str(id),
                estado_previo={
                    'descripcion': eliminado.descripcion,
                    'aplica_familiar': eliminado.aplica_familiar,
                },
                estado_nuevo=None,
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaParentescoSerializer(eliminado).data,
            'Parentesco eliminado correctamente.',
        )


class ReglaParentescoCrearView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_CREAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Crear un parentesco',
        request=CrearParentescoSerializer,
        responses={201: ReglaParentescoSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = CrearParentescoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            creado = crear_parentesco(
                repo,
                serializer.validated_data['descripcion'],
                serializer.validated_data.get('aplica_familiar', True),
                regla=_regla_parentesco_de(serializer),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PARENTESCO_CREADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PARENTESCO,
                recurso_id=str(creado.id),
                estado_previo=None,
                estado_nuevo={
                    'descripcion': creado.descripcion,
                    'aplica_familiar': creado.aplica_familiar,
                    **{c: getattr(creado, c) for c in _REGLAS_PARENTESCO_VISTA},
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaParentescoSerializer(creado).data,
            'Parentesco creado correctamente.',
            status=201,
        )

# Re-exportadas para que `presentation/urls.py` no cambie sus imports.
from .reglas_catalogos_pais_views import (  # noqa: E402,F401
    ReglaPaisCrearView,
    ReglaPaisDetailView,
)
from .reglas_catalogos_motivo_views import (  # noqa: E402,F401
    ReglaMotivoCategoriaView,
    ReglaMotivoCrearView,
    ReglaMotivoDetailView,
)
from .reglas_catalogos_nomina_views import (  # noqa: E402,F401
    ReglaNominaCrearView,
    ReglaNominaUpdateView,
)
from .reglas_catalogos_soporte_views import (  # noqa: E402,F401
    ReglaChecklistSoporteView,
    ReglaTipoSoporteCrearView,
    ReglaTipoSoporteDetailView,
    ReglaTipoSoporteReordenarView,
)
