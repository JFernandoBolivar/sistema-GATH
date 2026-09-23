"""
Vistas de catálogos de soporte del expediente de personal
(Reglas B4, B7). Lectura y CRUD con Envelope unificado `ok()`.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import OpenApiParameter, extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.personal.application.use_cases.listar_catalogos_soporte import (
    listar_alergias,
    listar_capacitaciones,
    listar_carreras,
    listar_codigos_postales,
    listar_condiciones_vivienda,
    listar_discapacidades,
    listar_grupos_capacitacion,
    listar_grupos_sanguineos,
    listar_instituciones,
    listar_menciones,
    listar_niveles_academicos,
    listar_patologias,
    listar_politicas,
    listar_regiones_talla,
    listar_tallas,
    listar_tipos_prenda,
)
from apps.personal.application.use_cases.gestionar_catalogos_soporte import (
    actualizar_alergia,
    actualizar_discapacidad,
    actualizar_patologia,
    actualizar_region_talla,
    actualizar_talla,
    actualizar_tipo_prenda,
    crear_alergia,
    crear_categoria_alergia,
    crear_categoria_discapacidad,
    crear_categoria_patologia,
    crear_discapacidad,
    crear_patologia,
    crear_region_talla,
    crear_talla,
    crear_tipo_prenda,
    eliminar_alergia,
    eliminar_categoria_alergia,
    eliminar_categoria_discapacidad,
    eliminar_categoria_patologia,
    eliminar_discapacidad,
    eliminar_patologia,
    eliminar_region_talla,
    eliminar_talla,
    eliminar_tipo_prenda,
    listar_categorias_alergia,
    listar_categorias_discapacidad,
    listar_categorias_patologia,
)
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.infrastructure.repositories.repo_catalogos_soporte_orm import RepoCatalogosSoporteORM
from apps.personal.presentation.serializers.catalogos_soporte_serializers import (
    AlergiaDetalleSerializer,
    AlergiaWriteSerializer,
    CatalogoItemSerializer,
    CategoriaDetalleSerializer,
    CategoriaWriteSerializer,
    CodigoPostalSerializer,
    DiscapacidadDetalleSerializer,
    DiscapacidadWriteSerializer,
    PatologiaDetalleSerializer,
    PatologiaWriteSerializer,
    RegionTallaDetalleSerializer,
    RegionTallaWriteSerializer,
    TallaDetalleSerializer,
    TallaWriteSerializer,
    TipoPrendaDetalleSerializer,
    TipoPrendaWriteSerializer,
)

PERMISO_VER = 'personal.ver'
PERMISO_CREAR = 'catalogos.crear'
PERMISO_EDITAR = 'catalogos.editar'
PERMISO_ELIMINAR = 'catalogos.eliminar'


def _query_id(request, nombre: str) -> int | None:
    """Lee un id positivo del query string; ignora valores no numéricos."""
    valor = request.query_params.get(nombre)
    return int(valor) if valor and str(valor).isdigit() and int(valor) > 0 else None


# ----------------------------------------------------------------------
# Catálogos de Soporte de Solo Lectura
# ----------------------------------------------------------------------

class PoliticasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar políticas de contratación', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_politicas(RepoPersonalORM().listar_politicas())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CondicionesViviendaListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar condiciones de vivienda', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_condiciones_vivienda(RepoPersonalORM().listar_condiciones_vivienda())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CodigosPostalesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(
        tags=['Personal'],
        summary='Listar códigos postales (opcionalmente por estado)',
        parameters=[OpenApiParameter('estado_id', int, required=False, description='Filtra los códigos postales del estado indicado.')],
        responses={200: CodigoPostalSerializer(many=True)},
    )
    def get(self, request):
        estado_id = _query_id(request, 'estado_id')
        dtos = listar_codigos_postales(RepoPersonalORM().listar_codigos_postales(estado_id=estado_id))
        return ok(CodigoPostalSerializer(dtos, many=True).data)


class GruposSanguineosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar grupos sanguíneos', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_grupos_sanguineos(RepoPersonalORM().listar_grupos_sanguineos())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class NivelesAcademicosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar niveles académicos', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_niveles_academicos(RepoPersonalORM().listar_niveles_academicos())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CarrerasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(
        tags=['Personal'],
        summary='Listar carreras (opcionalmente por nivel académico)',
        parameters=[OpenApiParameter('nivel_academico_id', int, required=False, description='Filtra las carreras del nivel académico indicado.')],
        responses={200: CatalogoItemSerializer(many=True)},
    )
    def get(self, request):
        nivel_academico_id = _query_id(request, 'nivel_academico_id')
        dtos = listar_carreras(RepoPersonalORM().listar_carreras(nivel_academico_id=nivel_academico_id))
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class MencionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar menciones por carrera', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        carrera_id = request.query_params.get('carrera_id')
        reg_id = int(carrera_id) if carrera_id and str(carrera_id).isdigit() else None
        dtos = listar_menciones(RepoPersonalORM().listar_menciones(carrera_id=reg_id))
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class InstitucionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar instituciones', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_instituciones(RepoPersonalORM().listar_instituciones())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class CapacitacionesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar capacitaciones/cursos', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_capacitaciones(RepoPersonalORM().listar_capacitaciones())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


class GruposCapacitacionListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(tags=['Personal'], summary='Listar grupos de capacitación', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_grupos_capacitacion(RepoPersonalORM().listar_grupos_capacitacion())
        return ok(CatalogoItemSerializer(dtos, many=True).data)


# ----------------------------------------------------------------------
# Tipos de Prenda (Listar, Crear, Editar, Eliminar)
# ----------------------------------------------------------------------

class TiposPrendaListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar tipos de prenda', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_tipos_prenda(RepoPersonalORM().listar_tipos_prenda())
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear tipo de prenda', request=TipoPrendaWriteSerializer, responses={201: TipoPrendaDetalleSerializer})
    def post(self, request):
        s = TipoPrendaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_tipo_prenda(RepoCatalogosSoporteORM(), s.validated_data['categoria'])
        return ok(TipoPrendaDetalleSerializer(entidad).data, 'Tipo de prenda creado.', status=201)


class TipoPrendaDetailView(APIView):
    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission(PERMISO_EDITAR)()]
        return [IsAuthenticated(), HasPermission(PERMISO_ELIMINAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Actualizar tipo de prenda', request=TipoPrendaWriteSerializer, responses={200: TipoPrendaDetalleSerializer})
    def put(self, request, pk: int):
        s = TipoPrendaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_tipo_prenda(RepoCatalogosSoporteORM(), pk, s.validated_data['categoria'])
        return ok(TipoPrendaDetalleSerializer(entidad).data, 'Tipo de prenda actualizado.')

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar tipo de prenda', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_tipo_prenda(RepoCatalogosSoporteORM(), pk)
        return ok(message='Tipo de prenda eliminado.')


# ----------------------------------------------------------------------
# Regiones de Talla (Listar, Crear, Editar, Eliminar)
# ----------------------------------------------------------------------

class RegionesTallaListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar regiones de talla', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_regiones_talla(RepoPersonalORM().listar_regiones_talla())
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear región de talla', request=RegionTallaWriteSerializer, responses={201: RegionTallaDetalleSerializer})
    def post(self, request):
        s = RegionTallaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_region_talla(
            RepoCatalogosSoporteORM(),
            s.validated_data['codigo'],
            s.validated_data.get('descripcion'),
        )
        return ok(RegionTallaDetalleSerializer(entidad).data, 'Región de talla creada.', status=201)


class RegionTallaDetailView(APIView):
    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission(PERMISO_EDITAR)()]
        return [IsAuthenticated(), HasPermission(PERMISO_ELIMINAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Actualizar región de talla', request=RegionTallaWriteSerializer, responses={200: RegionTallaDetalleSerializer})
    def put(self, request, pk: int):
        s = RegionTallaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_region_talla(
            RepoCatalogosSoporteORM(),
            pk,
            s.validated_data['codigo'],
            s.validated_data.get('descripcion'),
        )
        return ok(RegionTallaDetalleSerializer(entidad).data, 'Región de talla actualizada.')

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar región de talla', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_region_talla(RepoCatalogosSoporteORM(), pk)
        return ok(message='Región de talla eliminada.')


# ----------------------------------------------------------------------
# Tallas (Listar, Crear, Editar, Eliminar)
# ----------------------------------------------------------------------

class TallasListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar tallas por tipo de prenda', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        tipo_prenda_id = request.query_params.get('tipo_prenda_id')
        reg_id = int(tipo_prenda_id) if tipo_prenda_id and str(tipo_prenda_id).isdigit() else None
        dtos = listar_tallas(RepoPersonalORM().listar_tallas(tipo_prenda_id=reg_id))
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear talla', request=TallaWriteSerializer, responses={201: TallaDetalleSerializer})
    def post(self, request):
        s = TallaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_talla(
            RepoCatalogosSoporteORM(),
            s.validated_data['valor'],
            s.validated_data['region_id'],
            s.validated_data['tipo_prenda_id'],
        )
        return ok(TallaDetalleSerializer(entidad).data, 'Talla creada.', status=201)


class TallaDetailView(APIView):
    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission(PERMISO_EDITAR)()]
        return [IsAuthenticated(), HasPermission(PERMISO_ELIMINAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Actualizar talla', request=TallaWriteSerializer, responses={200: TallaDetalleSerializer})
    def put(self, request, pk: int):
        s = TallaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_talla(
            RepoCatalogosSoporteORM(),
            pk,
            s.validated_data['valor'],
            s.validated_data['region_id'],
            s.validated_data['tipo_prenda_id'],
        )
        return ok(TallaDetalleSerializer(entidad).data, 'Talla actualizada.')

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar talla', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_talla(RepoCatalogosSoporteORM(), pk)
        return ok(message='Talla eliminada.')


# ----------------------------------------------------------------------
# Alergias y Categorías de Alergia
# ----------------------------------------------------------------------

class AlergiasListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar alergias', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_alergias(RepoPersonalORM().listar_alergias())
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear alergia', request=AlergiaWriteSerializer, responses={201: AlergiaDetalleSerializer})
    def post(self, request):
        s = AlergiaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_alergia(
            RepoCatalogosSoporteORM(),
            s.validated_data['alergia'],
            s.validated_data['categoria_id'],
        )
        return ok(AlergiaDetalleSerializer(entidad).data, 'Alergia creada.', status=201)


class AlergiaDetailView(APIView):
    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission(PERMISO_EDITAR)()]
        return [IsAuthenticated(), HasPermission(PERMISO_ELIMINAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Actualizar alergia', request=AlergiaWriteSerializer, responses={200: AlergiaDetalleSerializer})
    def put(self, request, pk: int):
        s = AlergiaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_alergia(
            RepoCatalogosSoporteORM(),
            pk,
            s.validated_data['alergia'],
            s.validated_data['categoria_id'],
        )
        return ok(AlergiaDetalleSerializer(entidad).data, 'Alergia actualizada.')

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar alergia', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_alergia(RepoCatalogosSoporteORM(), pk)
        return ok(message='Alergia eliminada.')


class AlergiasCategoriasView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar categorías de alergia', responses={200: CategoriaDetalleSerializer(many=True)})
    def get(self, request):
        dtos = listar_categorias_alergia(RepoCatalogosSoporteORM())
        return ok(CategoriaDetalleSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear categoría de alergia', request=CategoriaWriteSerializer, responses={201: CategoriaDetalleSerializer})
    def post(self, request):
        s = CategoriaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_categoria_alergia(RepoCatalogosSoporteORM(), s.validated_data['nombre_categoria'])
        return ok(CategoriaDetalleSerializer(entidad).data, 'Categoría de alergia creada.', status=201)


class AlergiaCategoriaDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_ELIMINAR)]

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar categoría de alergia', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_categoria_alergia(RepoCatalogosSoporteORM(), pk)
        return ok(message='Categoría de alergia eliminada.')


# ----------------------------------------------------------------------
# Patologías y Categorías de Patología
# ----------------------------------------------------------------------

class PatologiasListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar patologías crónicas', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_patologias(RepoPersonalORM().listar_patologias())
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear patología crónica', request=PatologiaWriteSerializer, responses={201: PatologiaDetalleSerializer})
    def post(self, request):
        s = PatologiaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_patologia(
            RepoCatalogosSoporteORM(),
            s.validated_data['patologia'],
            s.validated_data['categoria_id'],
        )
        return ok(PatologiaDetalleSerializer(entidad).data, 'Patología creada.', status=201)


class PatologiaDetailView(APIView):
    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission(PERMISO_EDITAR)()]
        return [IsAuthenticated(), HasPermission(PERMISO_ELIMINAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Actualizar patología crónica', request=PatologiaWriteSerializer, responses={200: PatologiaDetalleSerializer})
    def put(self, request, pk: int):
        s = PatologiaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_patologia(
            RepoCatalogosSoporteORM(),
            pk,
            s.validated_data['patologia'],
            s.validated_data['categoria_id'],
        )
        return ok(PatologiaDetalleSerializer(entidad).data, 'Patología actualizada.')

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar patología crónica', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_patologia(RepoCatalogosSoporteORM(), pk)
        return ok(message='Patología eliminada.')


class PatologiasCategoriasView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar categorías de patología', responses={200: CategoriaDetalleSerializer(many=True)})
    def get(self, request):
        dtos = listar_categorias_patologia(RepoCatalogosSoporteORM())
        return ok(CategoriaDetalleSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear categoría de patología', request=CategoriaWriteSerializer, responses={201: CategoriaDetalleSerializer})
    def post(self, request):
        s = CategoriaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_categoria_patologia(RepoCatalogosSoporteORM(), s.validated_data['nombre_categoria'])
        return ok(CategoriaDetalleSerializer(entidad).data, 'Categoría de patología creada.', status=201)


class PatologiaCategoriaDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_ELIMINAR)]

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar categoría de patología', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_categoria_patologia(RepoCatalogosSoporteORM(), pk)
        return ok(message='Categoría de patología eliminada.')


# ----------------------------------------------------------------------
# Discapacidades y Categorías de Discapacidad
# ----------------------------------------------------------------------

class DiscapacidadesListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar discapacidades', responses={200: CatalogoItemSerializer(many=True)})
    def get(self, request):
        dtos = listar_discapacidades(RepoPersonalORM().listar_discapacidades())
        return ok(CatalogoItemSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear discapacidad', request=DiscapacidadWriteSerializer, responses={201: DiscapacidadDetalleSerializer})
    def post(self, request):
        s = DiscapacidadWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_discapacidad(
            RepoCatalogosSoporteORM(),
            s.validated_data['discapacidad'],
            s.validated_data['categoria_id'],
        )
        return ok(DiscapacidadDetalleSerializer(entidad).data, 'Discapacidad creada.', status=201)


class DiscapacidadDetailView(APIView):
    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission(PERMISO_EDITAR)()]
        return [IsAuthenticated(), HasPermission(PERMISO_ELIMINAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Actualizar discapacidad', request=DiscapacidadWriteSerializer, responses={200: DiscapacidadDetalleSerializer})
    def put(self, request, pk: int):
        s = DiscapacidadWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = actualizar_discapacidad(
            RepoCatalogosSoporteORM(),
            pk,
            s.validated_data['discapacidad'],
            s.validated_data['categoria_id'],
        )
        return ok(DiscapacidadDetalleSerializer(entidad).data, 'Discapacidad actualizada.')

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar discapacidad', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_discapacidad(RepoCatalogosSoporteORM(), pk)
        return ok(message='Discapacidad eliminada.')


class DiscapacidadesCategoriasView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), HasPermission(PERMISO_VER)()]
        return [IsAuthenticated(), HasPermission(PERMISO_CREAR)()]

    @extend_schema(tags=['Personal - Catálogos'], summary='Listar categorías de discapacidad', responses={200: CategoriaDetalleSerializer(many=True)})
    def get(self, request):
        dtos = listar_categorias_discapacidad(RepoCatalogosSoporteORM())
        return ok(CategoriaDetalleSerializer(dtos, many=True).data)

    @extend_schema(tags=['Personal - Catálogos'], summary='Crear categoría de discapacidad', request=CategoriaWriteSerializer, responses={201: CategoriaDetalleSerializer})
    def post(self, request):
        s = CategoriaWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entidad = crear_categoria_discapacidad(RepoCatalogosSoporteORM(), s.validated_data['nombre_categoria'])
        return ok(CategoriaDetalleSerializer(entidad).data, 'Categoría de discapacidad creada.', status=201)


class DiscapacidadCategoriaDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_ELIMINAR)]

    @extend_schema(tags=['Personal - Catálogos'], summary='Eliminar categoría de discapacidad', responses={200: None})
    def delete(self, request, pk: int):
        eliminar_categoria_discapacidad(RepoCatalogosSoporteORM(), pk)
        return ok(message='Categoría de discapacidad eliminada.')
