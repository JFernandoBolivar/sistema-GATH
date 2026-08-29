"""
Vistas delgadas de catálogos de soporte del expediente de personal
(Reglas B4, B7). Solo GET, con Envelope unificado `ok()`.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.personal.application.use_cases.listar_catalogos_soporte import (
    listar_carreras,
    listar_codigos_postales,
    listar_condiciones_vivienda,
    listar_grupos_sanguineos,
    listar_instituciones,
    listar_menciones,
    listar_niveles_academicos,
    listar_politicas,
)
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.presentation.serializers.catalogos_soporte_serializers import (
    CatalogoItemSerializer,
)

PERMISO = 'personal.ver'


class PoliticasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar políticas de contratación', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_politicas(RepoPersonalORM().listar_politicas())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CondicionesViviendaListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar condiciones de vivienda', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_condiciones_vivienda(RepoPersonalORM().listar_condiciones_vivienda())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CodigosPostalesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar códigos postales', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_codigos_postales(RepoPersonalORM().listar_codigos_postales())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class GruposSanguineosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar grupos sanguíneos', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_grupos_sanguineos(RepoPersonalORM().listar_grupos_sanguineos())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class NivelesAcademicosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar niveles académicos', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_niveles_academicos(RepoPersonalORM().listar_niveles_academicos())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CarrerasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar carreras', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_carreras(RepoPersonalORM().listar_carreras())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class MencionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar menciones por carrera', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        carrera_id = request.query_params.get('carrera_id')
        reg_id = int(carrera_id) if carrera_id and str(carrera_id).isdigit() else None
        dtos = listar_menciones(RepoPersonalORM().listar_menciones(carrera_id=reg_id))
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class InstitucionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO)]

    @extend_schema(tags=['Personal'], summary='Listar instituciones', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_instituciones(RepoPersonalORM().listar_instituciones())
        return ok(CatalogoItemSerializer(dtos, many=True).data)
