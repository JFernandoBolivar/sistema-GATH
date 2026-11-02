"""
Vistas delgadas de Organización (Reglas B4, B7).
Utilizan Envelope unificado `ok()` / `fail()` y autorización `HasPermission`.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.organizacion.application.use_cases.listar_dependencias import listar_dependencias
from apps.organizacion.application.use_cases.listar_direcciones_generales import listar_direcciones_generales
from apps.organizacion.application.use_cases.listar_direcciones_linea import listar_direcciones_linea
from apps.organizacion.application.use_cases.listar_coordinaciones import listar_coordinaciones
from apps.organizacion.application.use_cases.listar_organismos import listar_organismos_adscritos
from apps.organizacion.application.use_cases.gestionar_organizacion import (
    actualizar_coordinacion,
    actualizar_dependencia,
    actualizar_direccion_general,
    actualizar_direccion_linea,
    actualizar_organismo_adscrito,
    crear_coordinacion,
    crear_dependencia,
    crear_direccion_general,
    crear_direccion_linea,
    crear_organismo_adscrito,
    eliminar_coordinacion,
    eliminar_dependencia,
    eliminar_direccion_general,
    eliminar_direccion_linea,
    eliminar_organismo_adscrito,
)
from apps.organizacion.infrastructure.repositories.repo_organizacion_orm import RepoOrganizacionORM
from apps.organizacion.presentation.serializers.organizacion_serializers import (
    CoordinacionSerializer,
    CoordinacionWriteSerializer,
    DependenciaSerializer,
    DependenciaWriteSerializer,
    DireccionGeneralSerializer,
    DireccionGeneralWriteSerializer,
    DireccionLineaSerializer,
    DireccionLineaWriteSerializer,
    OrganismoAdscritoSerializer,
    OrganismoAdscritoWriteSerializer,
)


class DependenciasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.ver')]

    @extend_schema(
        tags=['Organización'],
        summary='Listar dependencias institucionales',
        responses={200: DependenciaSerializer(many=True)},
    )
    def get(self, request):
        repo = RepoOrganizacionORM()
        dtos = listar_dependencias(repo)
        serializer = DependenciaSerializer(dtos, many=True)
        return ok(serializer.data)


class DireccionesGeneralesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.ver')]

    @extend_schema(
        tags=['Organización'],
        summary='Listar direcciones generales',
        responses={200: DireccionGeneralSerializer(many=True)},
    )
    def get(self, request):
        dependencia_id = request.query_params.get('dependencia_id')
        dep_id = int(dependencia_id) if dependencia_id and str(dependencia_id).isdigit() else None
        repo = RepoOrganizacionORM()
        dtos = listar_direcciones_generales(repo, dependencia_id=dep_id)
        serializer = DireccionGeneralSerializer(dtos, many=True)
        return ok(serializer.data)


class DireccionesLineaListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.ver')]

    @extend_schema(
        tags=['Organización'],
        summary='Listar direcciones de línea',
        responses={200: DireccionLineaSerializer(many=True)},
    )
    def get(self, request):
        direccion_general_id = request.query_params.get('direccion_general_id')
        dg_id = int(direccion_general_id) if direccion_general_id and str(direccion_general_id).isdigit() else None
        repo = RepoOrganizacionORM()
        dtos = listar_direcciones_linea(repo, direccion_general_id=dg_id)
        serializer = DireccionLineaSerializer(dtos, many=True)
        return ok(serializer.data)


class CoordinacionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.ver')]

    @extend_schema(
        tags=['Organización'],
        summary='Listar coordinaciones',
        responses={200: CoordinacionSerializer(many=True)},
    )
    def get(self, request):
        dl_id = request.query_params.get('direccion_linea_id')
        dl_int = int(dl_id) if dl_id and str(dl_id).isdigit() else None

        repo = RepoOrganizacionORM()
        dtos = listar_coordinaciones(repo, direccion_linea_id=dl_int)
        serializer = CoordinacionSerializer(dtos, many=True)
        return ok(serializer.data)


class OrganismosAdscritosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.ver')]

    @extend_schema(
        tags=['Organización'],
        summary='Listar organismos adscritos',
        responses={200: OrganismoAdscritoSerializer(many=True)},
    )
    def get(self, request):
        repo = RepoOrganizacionORM()
        dtos = listar_organismos_adscritos(repo)
        serializer = OrganismoAdscritoSerializer(dtos, many=True)
        return ok(serializer.data)


class DependenciaCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.crear')]

    @extend_schema(tags=['Organización'], summary='Crear dependencia', request=DependenciaWriteSerializer, responses={201: DependenciaSerializer})
    def post(self, request):
        s = DependenciaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_dependencia(RepoOrganizacionORM(), s.validated_data['codigo'], s.validated_data['nombre'])
        return ok(DependenciaSerializer(entidad).data, 'Dependencia creada.', status=201)


class DependenciaUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.editar')]

    @extend_schema(tags=['Organización'], summary='Actualizar dependencia', request=DependenciaWriteSerializer, responses={200: DependenciaSerializer})
    def put(self, request, dependencia_id: int):
        s = DependenciaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_dependencia(RepoOrganizacionORM(), dependencia_id, s.validated_data['codigo'], s.validated_data['nombre'])
        return ok(DependenciaSerializer(entidad).data, 'Dependencia actualizada.')


class DependenciaDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.eliminar')]

    @extend_schema(tags=['Organización'], summary='Eliminar dependencia', responses={200: None})
    def delete(self, request, dependencia_id: int):
        eliminar_dependencia(RepoOrganizacionORM(), dependencia_id)
        return ok(message='Dependencia eliminada.')


class DireccionGeneralCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.crear')]

    @extend_schema(tags=['Organización'], summary='Crear dirección general', request=DireccionGeneralWriteSerializer, responses={201: DireccionGeneralSerializer})
    def post(self, request):
        s = DireccionGeneralWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_direccion_general(RepoOrganizacionORM(), s.validated_data['codigo'], s.validated_data['nombre'], s.validated_data.get('dependencia_id'))
        return ok(DireccionGeneralSerializer(entidad).data, 'Dirección general creada.', status=201)


class DireccionGeneralUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.editar')]

    @extend_schema(tags=['Organización'], summary='Actualizar dirección general', request=DireccionGeneralWriteSerializer, responses={200: DireccionGeneralSerializer})
    def put(self, request, direccion_general_id: int):
        s = DireccionGeneralWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_direccion_general(RepoOrganizacionORM(), direccion_general_id, s.validated_data['codigo'], s.validated_data['nombre'], s.validated_data.get('dependencia_id'))
        return ok(DireccionGeneralSerializer(entidad).data, 'Dirección general actualizada.')


class DireccionGeneralDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.eliminar')]

    @extend_schema(tags=['Organización'], summary='Eliminar dirección general', responses={200: None})
    def delete(self, request, direccion_general_id: int):
        eliminar_direccion_general(RepoOrganizacionORM(), direccion_general_id)
        return ok(message='Dirección general eliminada.')


class DireccionLineaCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.crear')]

    @extend_schema(tags=['Organización'], summary='Crear dirección de línea', request=DireccionLineaWriteSerializer, responses={201: DireccionLineaSerializer})
    def post(self, request):
        s = DireccionLineaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_direccion_linea(RepoOrganizacionORM(), s.validated_data['codigo'], s.validated_data['nombre'], s.validated_data.get('direccion_general_id'))
        return ok(DireccionLineaSerializer(entidad).data, 'Dirección de línea creada.', status=201)


class DireccionLineaUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.editar')]

    @extend_schema(tags=['Organización'], summary='Actualizar dirección de línea', request=DireccionLineaWriteSerializer, responses={200: DireccionLineaSerializer})
    def put(self, request, direccion_linea_id: int):
        s = DireccionLineaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_direccion_linea(RepoOrganizacionORM(), direccion_linea_id, s.validated_data['codigo'], s.validated_data['nombre'], s.validated_data.get('direccion_general_id'))
        return ok(DireccionLineaSerializer(entidad).data, 'Dirección de línea actualizada.')


class DireccionLineaDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.eliminar')]

    @extend_schema(tags=['Organización'], summary='Eliminar dirección de línea', responses={200: None})
    def delete(self, request, direccion_linea_id: int):
        eliminar_direccion_linea(RepoOrganizacionORM(), direccion_linea_id)
        return ok(message='Dirección de línea eliminada.')


class CoordinacionCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.crear')]

    @extend_schema(tags=['Organización'], summary='Crear coordinación', request=CoordinacionWriteSerializer, responses={201: CoordinacionSerializer})
    def post(self, request):
        s = CoordinacionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_coordinacion(RepoOrganizacionORM(), s.validated_data['codigo'], s.validated_data['nombre'], s.validated_data.get('direccion_linea_id'))
        return ok(CoordinacionSerializer(entidad).data, 'Coordinación creada.', status=201)


class CoordinacionUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.editar')]

    @extend_schema(tags=['Organización'], summary='Actualizar coordinación', request=CoordinacionWriteSerializer, responses={200: CoordinacionSerializer})
    def put(self, request, coordinacion_id: int):
        s = CoordinacionWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_coordinacion(RepoOrganizacionORM(), coordinacion_id, s.validated_data['codigo'], s.validated_data['nombre'], s.validated_data.get('direccion_linea_id'))
        return ok(CoordinacionSerializer(entidad).data, 'Coordinación actualizada.')


class CoordinacionDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.eliminar')]

    @extend_schema(tags=['Organización'], summary='Eliminar coordinación', responses={200: None})
    def delete(self, request, coordinacion_id: int):
        eliminar_coordinacion(RepoOrganizacionORM(), coordinacion_id)
        return ok(message='Coordinación eliminada.')


class OrganismoAdscritoCreateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.crear')]

    @extend_schema(tags=['Organización'], summary='Crear organismo adscrito', request=OrganismoAdscritoWriteSerializer, responses={201: OrganismoAdscritoSerializer})
    def post(self, request):
        s = OrganismoAdscritoWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_organismo_adscrito(RepoOrganizacionORM(), s.validated_data['nombre'], s.validated_data.get('parent_id'))
        return ok(OrganismoAdscritoSerializer(entidad).data, 'Organismo adscrito creado.', status=201)


class OrganismoAdscritoUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.editar')]

    @extend_schema(tags=['Organización'], summary='Actualizar organismo adscrito', request=OrganismoAdscritoWriteSerializer, responses={200: OrganismoAdscritoSerializer})
    def put(self, request, organismo_id: int):
        s = OrganismoAdscritoWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_organismo_adscrito(RepoOrganizacionORM(), organismo_id, s.validated_data['nombre'], s.validated_data.get('parent_id'))
        return ok(OrganismoAdscritoSerializer(entidad).data, 'Organismo adscrito actualizado.')


class OrganismoAdscritoDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('organizacion.eliminar')]

    @extend_schema(tags=['Organización'], summary='Eliminar organismo adscrito', responses={200: None})
    def delete(self, request, organismo_id: int):
        eliminar_organismo_adscrito(RepoOrganizacionORM(), organismo_id)
        return ok(message='Organismo adscrito eliminado.')
