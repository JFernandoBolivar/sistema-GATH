"""
Vistas de presentación para Reglas de Catálogos (A5).
"""
import uuid
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.configuracion.application.use_cases.gestionar_reglas_catalogos import (
    actualizar_motivo,
    cambiar_categoria_motivo,
    crear_nomina,
    crear_nuevo_motivo,
    crear_parentesco,
    editar_nomina,
    editar_parentesco,
    eliminar_motivo,
    eliminar_nomina,
    eliminar_parentesco,
    obtener_todas_las_reglas,
)
from apps.configuracion.domain.reglas_catalogos import (
    ACCION_MOTIVO_ACTUALIZADO,
    ACCION_MOTIVO_CATEGORIA_CAMBIADA,
    ACCION_MOTIVO_CREADO,
    ACCION_MOTIVO_ELIMINADO,
    ACCION_NOMINA_ACTUALIZADA,
    ACCION_NOMINA_CREADA,
    ACCION_NOMINA_ELIMINADA,
    ACCION_PARENTESCO_ACTUALIZADO,
    ACCION_PARENTESCO_CREADO,
    ACCION_PARENTESCO_ELIMINADO,
    MODULO_AUDITORIA_CONFIGURACION,
    RECURSO_REGLAS_MOTIVO,
    RECURSO_REGLAS_NOMINA,
    RECURSO_REGLAS_PARENTESCO,
)
from apps.configuracion.infrastructure.repositories.repo_reglas_catalogos_orm import (
    RepoReglasCatalogosORM,
)
from apps.configuracion.infrastructure.serializers.reglas_catalogos_serializers import (
    ActualizarMotivoSerializer,
    ActualizarNominaSerializer,
    ActualizarParentescoSerializer,
    CambiarCategoriaMotivoSerializer,
    CrearMotivoSerializer,
    CrearNominaSerializer,
    CrearParentescoSerializer,
    ReglaMotivoSerializer,
    ReglaNominaSerializer,
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
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PARENTESCO_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PARENTESCO,
                recurso_id=str(id),
                estado_previo={'aplica_familiar': anterior.aplica_familiar, 'descripcion': anterior.descripcion},
                estado_nuevo={'aplica_familiar': actualizado.aplica_familiar, 'descripcion': actualizado.descripcion},
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
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaParentescoSerializer(creado).data,
            'Parentesco creado correctamente.',
            status=201,
        )


class ReglaMotivoCategoriaView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Cambiar la categoría asignada a un motivo de movimiento',
        request=CambiarCategoriaMotivoSerializer,
        responses={200: ReglaMotivoSerializer, 400: MensajeRespuestaSerializer},
    )
    def patch(self, request, id: int):
        serializer = CambiarCategoriaMotivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anterior, actualizado = cambiar_categoria_motivo(
                repo, id, serializer.validated_data['categoria_id']
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_MOTIVO_CATEGORIA_CAMBIADA,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_MOTIVO,
                recurso_id=str(id),
                estado_previo={
                    'movimiento': anterior.movimiento,
                    'categoria_id': anterior.categoria_id,
                    'categoria_nombre': anterior.categoria_nombre,
                    'activo': anterior.activo,
                },
                estado_nuevo={
                    'movimiento': actualizado.movimiento,
                    'categoria_id': actualizado.categoria_id,
                    'categoria_nombre': actualizado.categoria_nombre,
                    'activo': actualizado.activo,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaMotivoSerializer(actualizado).data,
            'Categoría del motivo actualizada correctamente.',
        )


class ReglaMotivoDetailView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar nombre, categoría y/o estado de un motivo de movimiento',
        request=ActualizarMotivoSerializer,
        responses={200: ReglaMotivoSerializer, 400: MensajeRespuestaSerializer},
    )
    def patch(self, request, id: int):
        serializer = ActualizarMotivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anterior, actualizado = actualizar_motivo(
                repo,
                id,
                movimiento=datos.get('movimiento'),
                categoria_id=datos.get('categoria_id'),
                activo=datos.get('activo'),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_MOTIVO_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_MOTIVO,
                recurso_id=str(id),
                estado_previo={
                    'movimiento': anterior.movimiento,
                    'categoria_id': anterior.categoria_id,
                    'categoria_nombre': anterior.categoria_nombre,
                    'activo': anterior.activo,
                },
                estado_nuevo={
                    'movimiento': actualizado.movimiento,
                    'categoria_id': actualizado.categoria_id,
                    'categoria_nombre': actualizado.categoria_nombre,
                    'activo': actualizado.activo,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaMotivoSerializer(actualizado).data,
            'Motivo de movimiento actualizado correctamente.',
        )

    @extend_schema(
        tags=['Configuración'],
        summary='Eliminar físicamente un motivo de movimiento si no tiene referencias',
        responses={200: ReglaMotivoSerializer, 400: MensajeRespuestaSerializer},
    )
    def delete(self, request, id: int):
        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            eliminado = eliminar_motivo(repo, id)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_MOTIVO_ELIMINADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_MOTIVO,
                recurso_id=str(id),
                estado_previo={
                    'movimiento': eliminado.movimiento,
                    'categoria_id': eliminado.categoria_id,
                    'categoria_nombre': eliminado.categoria_nombre,
                    'activo': eliminado.activo,
                },
                estado_nuevo=None,
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaMotivoSerializer(eliminado).data,
            'Motivo de movimiento eliminado correctamente.',
        )


class ReglaMotivoCrearView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_CREAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Crear un nuevo motivo dentro de una categoría de movimiento',
        request=CrearMotivoSerializer,
        responses={201: ReglaMotivoSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = CrearMotivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            creado = crear_nuevo_motivo(
                repo,
                serializer.validated_data['movimiento'],
                serializer.validated_data['categoria_id'],
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_MOTIVO_CREADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_MOTIVO,
                recurso_id=str(creado.id),
                estado_previo=None,
                estado_nuevo={
                    'movimiento': creado.movimiento,
                    'categoria_id': creado.categoria_id,
                    'categoria_nombre': creado.categoria_nombre,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaMotivoSerializer(creado).data,
            'Motivo creado correctamente en la categoría indicada.',
            status=201,
        )


class ReglaNominaUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar nombre y marcas de un tipo de nómina',
        request=ActualizarNominaSerializer,
        responses={200: ReglaNominaSerializer, 400: MensajeRespuestaSerializer},
    )
    def patch(self, request, id: int):
        serializer = ActualizarNominaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anterior, actualizado = editar_nomina(
                repo,
                id,
                datos.get('nomina'),
                datos.get('es_activo'),
                datos.get('requiere_codig'),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_NOMINA_ACTUALIZADA,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_NOMINA,
                recurso_id=str(id),
                estado_previo={
                    'nomina': anterior.nomina,
                    'es_activo': anterior.es_activo,
                    'requiere_codig': anterior.requiere_codig,
                },
                estado_nuevo={
                    'nomina': actualizado.nomina,
                    'es_activo': actualizado.es_activo,
                    'requiere_codig': actualizado.requiere_codig,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaNominaSerializer(actualizado).data,
            'Reglas de la nómina actualizadas correctamente.',
        )

    @extend_schema(
        tags=['Configuración'],
        summary='Eliminar un tipo de nómina sin referencias (los reservados no se borran)',
        responses={200: ReglaNominaSerializer, 400: MensajeRespuestaSerializer},
    )
    def delete(self, request, id: int):
        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            eliminada = eliminar_nomina(repo, id)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_NOMINA_ELIMINADA,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_NOMINA,
                recurso_id=str(id),
                estado_previo={
                    'nomina': eliminada.nomina,
                    'es_activo': eliminada.es_activo,
                    'requiere_codig': eliminada.requiere_codig,
                },
                estado_nuevo=None,
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaNominaSerializer(eliminada).data,
            'Tipo de nómina eliminado correctamente.',
        )


class ReglaNominaCrearView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_CREAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Crear un tipo de nómina con su clasificación y requiere_codig',
        request=CrearNominaSerializer,
        responses={201: ReglaNominaSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = CrearNominaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            creada = crear_nomina(
                repo,
                datos['nomina'],
                datos.get('es_activo', True),
                datos.get('requiere_codig', False),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_NOMINA_CREADA,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_NOMINA,
                recurso_id=str(creada.id),
                estado_previo=None,
                estado_nuevo={
                    'nomina': creada.nomina,
                    'es_activo': creada.es_activo,
                    'requiere_codig': creada.requiere_codig,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaNominaSerializer(creada).data,
            'Tipo de nómina creado correctamente.',
            status=201,
        )
