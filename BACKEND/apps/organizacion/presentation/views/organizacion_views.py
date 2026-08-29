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
from apps.organizacion.infrastructure.repositories.repo_organizacion_orm import RepoOrganizacionORM
from apps.organizacion.presentation.serializers.organizacion_serializers import (
    DependenciaSerializer,
    DireccionGeneralSerializer,
    DireccionLineaSerializer,
    CoordinacionSerializer,
    OrganismoAdscritoSerializer,
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
        dg_id = request.query_params.get('direccion_general_id')
        dl_int = int(dl_id) if dl_id and str(dl_id).isdigit() else None
        dg_int = int(dg_id) if dg_id and str(dg_id).isdigit() else None

        repo = RepoOrganizacionORM()
        dtos = listar_coordinaciones(
            repo, direccion_linea_id=dl_int, direccion_general_id=dg_int
        )
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
