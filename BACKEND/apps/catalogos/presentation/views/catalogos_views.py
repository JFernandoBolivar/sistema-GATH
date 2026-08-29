"""
Vistas delgadas de Catálogos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permiso `catalogos.ver`.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.catalogos.application.use_cases.listar_geografia import (
    listar_estados,
    listar_municipios,
    listar_parroquias,
    listar_regiones,
)
from apps.catalogos.application.use_cases.listar_tablas_maestras import (
    listar_categorias_movimiento,
    listar_estados_civiles,
    listar_estatus,
    listar_grados,
    listar_parentescos,
    listar_sexos,
    listar_tipos_movimiento,
    listar_tipos_nomina,
    listar_tipos_personal,
    listar_tipos_procedencia,
)
from apps.catalogos.infrastructure.repositories.repo_catalogos_orm import RepoCatalogosORM
from apps.catalogos.presentation.serializers.catalogos_serializers import (
    CatalogoItemSerializer,
    EstadoSerializer,
    MunicipioSerializer,
    ParroquiaSerializer,
    RegionSerializer,
)


class RegionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar regiones geográficas', responses={200: RegionSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_regiones(repo)
        return ok(RegionSerializer(dtos, many=True).data)


class EstadosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar estados', responses={200: EstadoSerializer(many=True)})
    def get(self, request):
        region_id = request.query_params.get('region_id')
        reg_id = int(region_id) if region_id and str(region_id).isdigit() else None
        repo = RepoCatalogosORM()
        dtos = listar_estados(repo, region_id=reg_id)
        return ok(EstadoSerializer(dtos, many=True).data)


class MunicipiosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar municipios por estado', responses={200: MunicipioSerializer(many=True)})
    def get(self, request):
        estado_id = request.query_params.get('estado_id')
        est_id = int(estado_id) if estado_id and str(estado_id).isdigit() else None
        repo = RepoCatalogosORM()
        dtos = listar_municipios(repo, estado_id=est_id)
        return ok(MunicipioSerializer(dtos, many=True).data)


class ParroquiasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar parroquias por municipio', responses={200: ParroquiaSerializer(many=True)})
    def get(self, request):
        municipio_id = request.query_params.get('municipio_id')
        mun_id = int(municipio_id) if municipio_id and str(municipio_id).isdigit() else None
        repo = RepoCatalogosORM()
        dtos = listar_parroquias(repo, municipio_id=mun_id)
        return ok(ParroquiaSerializer(dtos, many=True).data)


class SexosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar opciones de sexo', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_sexos(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class EstatusListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar estatus laborales', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_estatus(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class TiposPersonalListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar tipos de personal', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_tipos_personal(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class TiposNominaListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar tipos de nómina', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_tipos_nomina(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class ParentescosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar parentescos familiares', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_parentescos(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class TiposProcedenciaListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar tipos de procedencia', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_tipos_procedencia(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class EstadosCivilesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar estados civiles', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_estados_civiles(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class GradosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar grados', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_grados(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CategoriasMovimientoListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar categorías de movimiento de cargo', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        repo = RepoCatalogosORM()
        dtos = listar_categorias_movimiento(repo)
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class TiposMovimientoListView(APIView):
    """
    GET /api/v1/catalogos/tipos-movimiento/?categoria=EGRESO — Fase 2.5 del
    plan de reparación. Sustituye a los 5 endpoints de listado por categoría
    del legado (`RAC/views/historial_views.py`: fallecimiento, egreso,
    internos/traslado, suspendido, suspendido_pasivo) con un único endpoint
    filtrable por `categoria`, funcionalmente equivalente.
    """
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar tipos de movimiento (motivos), opcionalmente filtrados por categoría', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        categoria = request.query_params.get('categoria')
        repo = RepoCatalogosORM()
        dtos = listar_tipos_movimiento(repo, categoria=categoria)
        return ok(CatalogoItemSerializer(dtos, many=True).data)
