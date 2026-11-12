"""Vistas de reglas de nÃ³mina."""
from .reglas_catalogos_comun import *  # noqa: F403


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
