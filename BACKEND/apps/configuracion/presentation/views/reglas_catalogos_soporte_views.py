"""Vistas de reglas de tipos de soporte y checklist."""
from .reglas_catalogos_comun import *  # noqa: F403


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


class ReglaTipoSoporteReordenarView(APIView):
    permission_classes = [IsAuthenticated, HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Guardar el nuevo orden de la lista de tipos de soporte (FIX-DIS2)',
        request=ReordenarTiposSoporteSerializer,
        responses={200: ReglaTipoSoporteSerializer(many=True), 400: MensajeRespuestaSerializer},
    )
    def put(self, request):
        serializer = ReordenarTiposSoporteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        if datos.get('ordenes'):
            pares = [(item['id'], item['orden']) for item in datos['ordenes']]
        else:
            pares = [(tipo_id, idx + 1) for idx, tipo_id in enumerate(datos['ids'])]

        repo = RepoReglasCatalogosORM()
        with transaction.atomic():
            actualizados = reordenar_tipos_soporte(repo, pares)
            registrar_auditoria(
                trace_id=_trace(request),
                accion=ACCION_TIPO_SOPORTE_ACTUALIZADO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_REGLAS_TIPO_SOPORTE,
                recurso_id='reordenar',
                estado_previo=None,
                estado_nuevo=[{'id': t.id, 'orden': t.orden} for t in actualizados],
                **_actor(request),
                **origen_de_peticion(request),
            )

        return ok(
            ReglaTipoSoporteSerializer(actualizados, many=True).data,
            'Orden de tipos de soporte actualizado correctamente.',
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
