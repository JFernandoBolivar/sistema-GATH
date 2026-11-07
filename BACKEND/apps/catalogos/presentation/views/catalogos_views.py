"""
Vistas delgadas de Catálogos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permiso `catalogos.ver`.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import OpenApiParameter, extend_schema

from core.presentation.cache_catalogos import invalidar_catalogos, ok_catalogo
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.catalogos.infrastructure.mappers.mapper_catalogos import tipo_movimiento_a_entidad
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import crear_motivo_en_categoria
from core.domain.categorias_motivo import categoria_conocida, categoria_de
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
    listar_nacionalidades,
    listar_paises,
)
from apps.catalogos.application.use_cases.crear_parentesco import crear_parentesco
from apps.catalogos.infrastructure.repositories.repo_catalogos_orm import RepoCatalogosORM
from apps.catalogos.presentation.serializers.catalogos_serializers import (
    CatalogoItemSerializer,
    CrearParentescoInputSerializer,
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
        return ok_catalogo(
            request,
            f'catalogos:estados:{reg_id or "todos"}',
            lambda: EstadoSerializer(
                listar_estados(RepoCatalogosORM(), region_id=reg_id), many=True
            ).data,
        )


class MunicipiosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar municipios por estado', responses={200: MunicipioSerializer(many=True)})
    def get(self, request):
        estado_id = request.query_params.get('estado_id')
        est_id = int(estado_id) if estado_id and str(estado_id).isdigit() else None
        return ok_catalogo(
            request,
            f'catalogos:municipios:{est_id or "todos"}',
            lambda: MunicipioSerializer(
                listar_municipios(RepoCatalogosORM(), estado_id=est_id), many=True
            ).data,
        )


class ParroquiasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar parroquias por municipio', responses={200: ParroquiaSerializer(many=True)})
    def get(self, request):
        municipio_id = request.query_params.get('municipio_id')
        mun_id = int(municipio_id) if municipio_id and str(municipio_id).isdigit() else None
        return ok_catalogo(
            request,
            f'catalogos:parroquias:{mun_id or "todas"}',
            lambda: ParroquiaSerializer(
                listar_parroquias(RepoCatalogosORM(), municipio_id=mun_id), many=True
            ).data,
        )


class PaisesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar países', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        return ok_catalogo(
            request,
            'catalogos:paises',
            lambda: CatalogoItemSerializer(
                listar_paises(RepoCatalogosORM()), many=True
            ).data,
        )


class SexosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar opciones de sexo', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        return ok_catalogo(
            request,
            'catalogos:sexos',
            lambda: CatalogoItemSerializer(
                listar_sexos(RepoCatalogosORM()), many=True
            ).data,
        )


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
        solo_especiales = request.query_params.get('solo_especiales', '').lower() in ('true', '1')
        solo_pasivos = request.query_params.get('solo_pasivos', '').lower() in ('true', '1')
        solo_activos = request.query_params.get('solo_activos', '').lower() in ('true', '1')
        clave = (
            f'catalogos:tipos-nomina:{int(solo_especiales)}'
            f':{int(solo_pasivos)}:{int(solo_activos)}'
        )
        return ok_catalogo(
            request,
            clave,
            lambda: CatalogoItemSerializer(
                listar_tipos_nomina(
                    RepoCatalogosORM(),
                    solo_especiales=solo_especiales,
                    solo_pasivos=solo_pasivos,
                    solo_activos=solo_activos,
                ),
                many=True,
            ).data,
        )


class ParentescosListView(APIView):
    """
    GET  /api/v1/catalogos/parentescos/?uso=familiar|contacto — filtra por uso.
         `?uso=familiar`: solo parentescos permitidos para familiares (aplica_familiar=True).
         `?uso=contacto`: todos los parentescos (familiares y de emergencia).
    POST /api/v1/catalogos/parentescos/ {descripcion, uso: "contacto"} — crea un nuevo
         parentesco con aplica_familiar=False. Requiere `catalogos.crear`.
    """
    def get_permissions(self):
        codigo = 'catalogos.ver' if self.request.method == 'GET' else 'catalogos.crear'
        return [IsAuthenticated(), HasPermission(codigo)()]

    @extend_schema(
        tags=['Catálogos'],
        summary='Listar parentescos familiares o de contactos',
        parameters=[
            OpenApiParameter('uso', type=str, description='familiar (solo familiares) o contacto (todos)'),
        ],
        responses={200: CatalogoItemSerializer(many=True)},
    )
    def get(self, request):
        uso = request.query_params.get('uso', '').lower()
        solo_familiares = (uso == 'familiar')
        clave = f'catalogos:parentescos:{uso or "todos"}'
        return ok_catalogo(
            request,
            clave,
            lambda: CatalogoItemSerializer(
                listar_parentescos(RepoCatalogosORM(), solo_familiares=solo_familiares),
                many=True,
            ).data,
        )

    @extend_schema(
        tags=['Catálogos'],
        summary='Crear nuevo parentesco (para contactos de emergencia)',
        request=CrearParentescoInputSerializer,
        responses={201: CatalogoItemSerializer},
    )
    def post(self, request):
        serializer = CrearParentescoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        repo = RepoCatalogosORM()
        dto = crear_parentesco(
            repo=repo,
            descripcion=serializer.validated_data['descripcion'],
            uso=serializer.validated_data['uso'],
        )
        invalidar_catalogos()
        return ok(CatalogoItemSerializer(dto).data, message='Parentesco registrado correctamente.', status=201)


class TiposProcedenciaListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar tipos de procedencia', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        return ok_catalogo(
            request,
            'catalogos:tipos-procedencia',
            lambda: CatalogoItemSerializer(
                listar_tipos_procedencia(RepoCatalogosORM()), many=True
            ).data,
        )


class EstadosCivilesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar estados civiles', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        return ok_catalogo(
            request,
            'catalogos:estados-civiles',
            lambda: CatalogoItemSerializer(
                listar_estados_civiles(RepoCatalogosORM()), many=True
            ).data,
        )


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
    GET  /api/v1/catalogos/tipos-movimiento/?operacion=cambiar_cargo — motivos de la
         categoría que corresponde a esa operación (mapa en `core.domain.categorias_motivo`).
         `?categoria=EGRESO` sigue disponible para consultas genéricas (reportes).
    POST /api/v1/catalogos/tipos-movimiento/ {movimiento, operacion|categoria} — crea un
         motivo nuevo («Otros…») en la categoría de la operación. Requiere `catalogos.crear`.
         Validación: 3–100 caracteres y sin duplicados (sin distinguir mayúsculas) en la categoría.
    """
    def get_permissions(self):
        codigo = 'catalogos.ver' if self.request.method == 'GET' else 'catalogos.crear'
        return [IsAuthenticated(), HasPermission(codigo)()]

    @extend_schema(tags=['Catálogos'], summary='Listar tipos de movimiento (motivos), filtrados por operación o categoría', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        operacion = request.query_params.get('operacion')
        categoria = request.query_params.get('categoria')
        if operacion:
            categoria = categoria_de(operacion).value
        repo = RepoCatalogosORM()
        dtos = listar_tipos_movimiento(repo, categoria=categoria)
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Catálogos'], summary='Crear tipo de movimiento (motivo) en la categoría de una operación', responses={201: CatalogoItemSerializer})
    def post(self, request):
        operacion = request.data.get('operacion')
        if operacion:
            categoria = categoria_de(operacion)
        else:
            categoria = categoria_conocida(request.data.get('categoria'))
        tipo = crear_motivo_en_categoria(request.data.get('movimiento'), categoria)
        return ok(CatalogoItemSerializer(tipo_movimiento_a_entidad(tipo)).data, message='Motivo registrado correctamente.', status=201)


class NacionalidadesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('catalogos.ver')]

    @extend_schema(tags=['Catálogos'], summary='Listar nacionalidades', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        return ok_catalogo(
            request,
            'catalogos:nacionalidades',
            lambda: CatalogoItemSerializer(
                listar_nacionalidades(RepoCatalogosORM()), many=True
            ).data,
        )
