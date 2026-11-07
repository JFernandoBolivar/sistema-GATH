"""
Vistas de presentación para Reglas de Catálogos (A5).
"""
import uuid
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.configuracion.application.use_cases.gestionar_reglas_catalogos import (
    actualizar_checklist_soporte,
    actualizar_motivo,
    cambiar_categoria_motivo,
    crear_nomina,
    crear_nuevo_motivo,
    crear_pais,
    crear_parentesco,
    crear_tipo_soporte,
    editar_nomina,
    editar_pais,
    editar_parentesco,
    editar_tipo_soporte,
    eliminar_motivo,
    eliminar_nomina,
    eliminar_pais,
    eliminar_parentesco,
    eliminar_tipo_soporte,
    obtener_todas_las_reglas,
)
from apps.configuracion.domain.reglas_catalogos import (
    ACCION_CHECKLIST_SOPORTE_ACTUALIZADO,
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
    ACCION_PAIS_ACTUALIZADO,
    ACCION_PAIS_CREADO,
    ACCION_PAIS_ELIMINADO,
    ACCION_TIPO_SOPORTE_ACTUALIZADO,
    ACCION_TIPO_SOPORTE_CREADO,
    ACCION_TIPO_SOPORTE_ELIMINADO,
    MODULO_AUDITORIA_CONFIGURACION,
    RECURSO_REGLAS_MOTIVO,
    RECURSO_REGLAS_NOMINA,
    RECURSO_REGLAS_PAIS,
    RECURSO_REGLAS_PARENTESCO,
    RECURSO_REGLAS_TIPO_SOPORTE,
)
from apps.configuracion.infrastructure.repositories.repo_reglas_catalogos_orm import (
    RepoReglasCatalogosORM,
)
from apps.configuracion.infrastructure.serializers.reglas_catalogos_serializers import (
    ActualizarChecklistSoporteSerializer,
    ActualizarMotivoSerializer,
    ActualizarNominaSerializer,
    ActualizarParentescoSerializer,
    ActualizarPaisSerializer,
    ActualizarTipoSoporteSerializer,
    CambiarCategoriaMotivoSerializer,
    CrearMotivoSerializer,
    CrearNominaSerializer,
    CrearPaisSerializer,
    CrearParentescoSerializer,
    CrearTipoSoporteSerializer,
    ReglaChecklistSoporteSerializer,
    ReglaMotivoSerializer,
    ReglaNominaSerializer,
    ReglaPaisSerializer,
    ReglaParentescoSerializer,
    ReglaTipoSoporteSerializer,
    ReglasCatalogosCompletoSerializer,
)
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasAnyPermission
from core.presentation.schema import MensajeRespuestaSerializer
from core.domain.tipos_soporte import ItemChecklistSoporte

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


class ReglaPaisCrearView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_CREAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Crear un país del catálogo',
        request=CrearPaisSerializer,
        responses={201: ReglaPaisSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = CrearPaisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            creado = crear_pais(repo, datos['nombre'], datos['codigo'])
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PAIS_CREADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PAIS,
                recurso_id=str(creado.id),
                estado_previo=None,
                estado_nuevo={
                    'nombre': creado.nombre,
                    'codigo': creado.codigo,
                    'es_venezuela': creado.es_venezuela,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(ReglaPaisSerializer(creado).data, 'País creado correctamente.', status=201)


class ReglaPaisDetailView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar el nombre o el código de un país',
        request=ActualizarPaisSerializer,
        responses={200: ReglaPaisSerializer, 400: MensajeRespuestaSerializer},
    )
    def patch(self, request, id: int):
        serializer = ActualizarPaisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anterior, actualizado = editar_pais(
                repo, id, datos.get('nombre'), datos.get('codigo'),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PAIS_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PAIS,
                recurso_id=str(id),
                estado_previo={'nombre': anterior.nombre, 'codigo': anterior.codigo},
                estado_nuevo={'nombre': actualizado.nombre, 'codigo': actualizado.codigo},
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(ReglaPaisSerializer(actualizado).data, 'País actualizado correctamente.')

    @extend_schema(
        tags=['Configuración'],
        summary='Eliminar un país sin viviendas asociadas (Venezuela no se elimina)',
        responses={200: ReglaPaisSerializer, 400: MensajeRespuestaSerializer},
    )
    def delete(self, request, id: int):
        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            eliminado = eliminar_pais(repo, id)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_PAIS_ELIMINADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_PAIS,
                recurso_id=str(id),
                estado_previo={
                    'nombre': eliminado.nombre,
                    'codigo': eliminado.codigo,
                },
                estado_nuevo=None,
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(ReglaPaisSerializer(eliminado).data, 'País eliminado correctamente.')


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


class ReglaTipoSoporteCrearView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_CREAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Crear un tipo de soporte documental (O41)',
        request=CrearTipoSoporteSerializer,
        responses={201: ReglaTipoSoporteSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = CrearTipoSoporteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            creado = crear_tipo_soporte(
                repo, datos['codigo'], datos['nombre'], datos.get('orden', 0),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_TIPO_SOPORTE_CREADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_TIPO_SOPORTE,
                recurso_id=str(creado.id),
                estado_previo=None,
                estado_nuevo={
                    'codigo': creado.codigo,
                    'nombre': creado.nombre,
                    'orden': creado.orden,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaTipoSoporteSerializer(creado).data,
            'Tipo de soporte creado correctamente.',
            status=201,
        )


class ReglaTipoSoporteDetailView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar un tipo de soporte documental (O41)',
        request=ActualizarTipoSoporteSerializer,
        responses={200: ReglaTipoSoporteSerializer, 400: MensajeRespuestaSerializer},
    )
    def patch(self, request, id: int):
        serializer = ActualizarTipoSoporteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anterior, actualizado = editar_tipo_soporte(
                repo,
                id,
                datos.get('codigo'),
                datos.get('nombre'),
                datos.get('orden'),
            )
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_TIPO_SOPORTE_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_TIPO_SOPORTE,
                recurso_id=str(id),
                estado_previo={
                    'codigo': anterior.codigo,
                    'nombre': anterior.nombre,
                    'orden': anterior.orden,
                },
                estado_nuevo={
                    'codigo': actualizado.codigo,
                    'nombre': actualizado.nombre,
                    'orden': actualizado.orden,
                },
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaTipoSoporteSerializer(actualizado).data,
            'Tipo de soporte actualizado correctamente.',
        )

    @extend_schema(
        tags=['Configuración'],
        summary='Eliminar un tipo de soporte no reservado y sin checklist (O41)',
        responses={200: ReglaTipoSoporteSerializer, 400: MensajeRespuestaSerializer},
    )
    def delete(self, request, id: int):
        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            eliminado = eliminar_tipo_soporte(repo, id)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_TIPO_SOPORTE_ELIMINADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_TIPO_SOPORTE,
                recurso_id=str(id),
                estado_previo={
                    'codigo': eliminado.codigo,
                    'nombre': eliminado.nombre,
                    'orden': eliminado.orden,
                },
                estado_nuevo=None,
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaTipoSoporteSerializer(eliminado).data,
            'Tipo de soporte eliminado correctamente.',
        )


class ReglaChecklistSoporteView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Reemplazar el checklist de tipos de soporte de una sección (O41)',
        request=ActualizarChecklistSoporteSerializer,
        responses={200: ReglaChecklistSoporteSerializer(many=True), 400: MensajeRespuestaSerializer},
    )
    def put(self, request, seccion: str):
        serializer = ActualizarChecklistSoporteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = [
            ItemChecklistSoporte(
                tipo_soporte_id=item['tipo_soporte_id'],
                permitido=item.get('permitido', True),
                requerido=item.get('requerido', False),
            )
            for item in serializer.validated_data['tipos']
        ]

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            anteriores, actualizado = actualizar_checklist_soporte(repo, seccion, items)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_CHECKLIST_SOPORTE_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_TIPO_SOPORTE,
                recurso_id=seccion,
                estado_previo=[
                    {
                        'tipo_soporte_id': fila.tipo_soporte_id,
                        'codigo': fila.codigo,
                        'permitido': fila.permitido,
                        'requerido': fila.requerido,
                    }
                    for fila in anteriores
                ],
                estado_nuevo=[
                    {
                        'tipo_soporte_id': fila.tipo_soporte_id,
                        'codigo': fila.codigo,
                        'permitido': fila.permitido,
                        'requerido': fila.requerido,
                    }
                    for fila in actualizado
                ],
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaChecklistSoporteSerializer(actualizado, many=True).data,
            'Checklist de tipos de soporte actualizado correctamente.',
        )
