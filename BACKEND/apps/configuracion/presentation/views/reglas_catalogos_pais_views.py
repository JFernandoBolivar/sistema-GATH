"""Vistas de reglas de paÃ­s (catÃ¡logos)."""
from .reglas_catalogos_comun import *  # noqa: F403


class ReglaPaisCrearView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasAnyPermission(PERMISO_VER, PERMISO_CATALOGOS_VER)()]
        return [IsAuthenticated(), HasAnyPermission(PERMISO_EDITAR, PERMISO_CATALOGOS_CREAR)()]

    @extend_schema(
        tags=['Configuración'],
        summary='Listar países del catálogo con paginación y búsqueda',
        parameters=[
            OpenApiParameter('q', str, description='Búsqueda por nombre o código'),
            OpenApiParameter('page', int, description='Número de página (base 1)'),
            OpenApiParameter('page_size', int, description='Tamaño de página (10, 25, 50)'),
        ],
        responses={200: inline_serializer('ListaPaisesPaginada', fields={
            'items': ReglaPaisSerializer(many=True),
            'total': serializers.IntegerField(),
            'page': serializers.IntegerField(),
            'page_size': serializers.IntegerField(),
        })},
    )
    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get('page_size', 10))))
        except (TypeError, ValueError):
            page_size = 10

        items, total = buscar_paises_paginado(
            RepoReglasCatalogosORM(), texto=q, pagina=page, tamano_pagina=page_size,
        )
        serializer = ReglaPaisSerializer(items, many=True)
        return ok({
            'items': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })

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
