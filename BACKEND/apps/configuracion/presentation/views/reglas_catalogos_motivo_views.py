"""Vistas de reglas de motivos por categorÃ­a."""
from .reglas_catalogos_comun import *  # noqa: F403


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
