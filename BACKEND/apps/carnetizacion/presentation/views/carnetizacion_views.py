"""
Vistas delgadas de Carnetización (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.carnetizacion.application.use_cases.generar_pdf_carnet import generar_pdf_carnet
from apps.carnetizacion.application.use_cases.gestionar_plantillas import (
    activar_plantilla,
    listar_plantillas,
)
from apps.carnetizacion.application.use_cases.listar_carnets import emitir_carnet, listar_carnets
from apps.carnetizacion.application.use_cases.revocar_carnet import revocar_carnet
from apps.carnetizacion.application.use_cases.validar_carnet import (
    validar_carnet_por_hash,
    validar_carnet_por_id,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)
from apps.carnetizacion.presentation.serializers.carnetizacion_serializers import (
    CarnetSerializer,
    EmitirCarnetInputSerializer,
    PlantillaCarnetSerializer,
    ValidacionCarnetSerializer,
)


class CarnetsListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar carnets emitidos', responses={200: CarnetSerializer(many=True)})
    def get(self, request):
        cedula = request.query_params.get('cedula')
        repo = RepoCarnetizacionORM()
        dtos = listar_carnets(repo, empleado_cedula=cedula)
        return ok(CarnetSerializer(dtos, many=True).data)

    @extend_schema(tags=['Carnetización'], summary='Emitir nuevo carnet institucional', request=EmitirCarnetInputSerializer, responses={200: CarnetSerializer})
    def post(self, request):
        serializer = EmitirCarnetInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoCarnetizacionORM()
        dto = emitir_carnet(
            repo,
            empleado_cedula=serializer.validated_data['empleado_cedula'],
            motivo_id=serializer.validated_data['motivo_id'],
            observaciones=serializer.validated_data.get('observaciones'),
        )
        return ok(CarnetSerializer(dto).data)


class CarnetPdfView(APIView):
    """
    GET /api/v1/carnetizacion/<carnet_id>/pdf/ — genera y descarga el PDF
    físico del carnet (QR + foto + plantilla, Fase 2.3 del plan de
    reparación). Antes, `emitir_carnet` solo creaba el registro en base de
    datos y no existía forma de obtener el carnet imprimible.
    """

    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Descargar el PDF de un carnet emitido', responses={200: OpenApiTypes.BINARY})
    def get(self, request, carnet_id: int):
        pdf_bytes = generar_pdf_carnet(RepoCarnetizacionORM(), carnet_id)
        respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
        respuesta['Content-Disposition'] = f'inline; filename="carnet_{carnet_id}.pdf"'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta


class RevocarCarnetView(APIView):
    """
    POST /api/v1/carnetizacion/<carnet_id>/revocar/ — invalida un carnet
    emitido (Fase 2.3 del plan de reparación). El permiso
    `carnetizacion.revocar` ya estaba sembrado en el catálogo sin código
    detrás.
    """

    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.revocar')]

    @extend_schema(tags=['Carnetización'], summary='Revocar un carnet emitido', responses={200: CarnetSerializer})
    def post(self, request, carnet_id: int):
        dto = revocar_carnet(RepoCarnetizacionORM(), carnet_id)
        return ok(CarnetSerializer(dto).data, 'Carnet revocado correctamente.')


class ValidarCarnetHashView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=['Carnetización'], summary='Validar autenticidad de carnet por hash QR (Público)', responses={200: ValidacionCarnetSerializer})
    def get(self, request, security_hash: str):
        repo = RepoCarnetizacionORM()
        dto = validar_carnet_por_hash(repo, security_hash=security_hash)
        return ok(ValidacionCarnetSerializer(dto).data)


class ValidarCarnetIdView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Validar estado de carnet por ID', responses={200: ValidacionCarnetSerializer})
    def get(self, request, carnet_id: int):
        repo = RepoCarnetizacionORM()
        dto = validar_carnet_por_id(repo, carnet_id=carnet_id)
        return ok(ValidacionCarnetSerializer(dto).data)


class PlantillasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar plantillas de diseño de carnet', responses={200: PlantillaCarnetSerializer(many=True)})
    def get(self, request):
        repo = RepoCarnetizacionORM()
        dtos = listar_plantillas(repo)
        return ok(PlantillaCarnetSerializer(dtos, many=True).data)


class ActivarPlantillaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.emitir')]

    @extend_schema(tags=['Carnetización'], summary='Activar plantilla de diseño', responses={200: PlantillaCarnetSerializer})
    def post(self, request, plantilla_id: int):
        repo = RepoCarnetizacionORM()
        dto = activar_plantilla(repo, plantilla_id=plantilla_id)
        return ok(PlantillaCarnetSerializer(dto).data)


class EstadisticasCarnetsView(APIView):
    """GET /api/v1/carnetizacion/estadisticas/ — paridad con el legado `estadisticas`."""

    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Estadísticas de carnets emitidos')
    def get(self, request):
        repo = RepoCarnetizacionORM()
        stats = repo.obtener_estadisticas_carnets()
        return ok(stats)


class PlantillaCreateView(APIView):
    """POST /api/v1/carnetizacion/plantillas/ — subir plantilla de diseño (multipart)."""

    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.emitir')]

    @extend_schema(tags=['Carnetización'], summary='Subir plantilla de diseño de carnet')
    def post(self, request):
        from rest_framework import serializers as _sr
        class _S(_sr.Serializer):
            nombre = _sr.CharField(max_length=100)
            imagen = _sr.ImageField()
            activar = _sr.BooleanField(required=False, default=False)
        s = _S(data=request.data)
        s.is_valid(raise_exception=True)
        repo = RepoCarnetizacionORM()
        plantilla = repo.crear_plantilla(
            nombre=s.validated_data['nombre'],
            imagen=s.validated_data['imagen'],
            activar=s.validated_data.get('activar', False),
        )
        from apps.carnetizacion.presentation.serializers.carnetizacion_serializers import PlantillaCarnetSerializer
        return ok(PlantillaCarnetSerializer(plantilla).data, 'Plantilla subida.', status=201)


class CarnetBuscarPersonalView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Buscar personal para emisión de carnet')
    def get(self, request):
        query = request.query_params.get('q', '')
        repo = RepoCarnetizacionORM()
        resultados = repo.buscar_personal(query)
        return ok(resultados)


class MotivosEmisionListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Listar motivos de emisión de carnet')
    def get(self, request):
        from apps.carnetizacion.infrastructure.models.carnetizacion_models import MotivosEmisionModel
        motivos = MotivosEmisionModel.objects.all().order_by('nombre')
        return ok([{"id": m.id, "nombre": m.nombre} for m in motivos])


class CarnetActualizarVistaPreviaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.ver')]

    @extend_schema(tags=['Carnetización'], summary='Actualizar vista previa HTML del carnet')
    def post(self, request, cedula: str):
        nombre = request.data.get('nombre')
        repo = RepoCarnetizacionORM()
        html = repo.generar_vista_previa(cedula=cedula, nombre_override=nombre)
        return ok({"vista_previa": html})


class CarnetSubirFotoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.emitir')]

    @extend_schema(tags=['Carnetización'], summary='Subir foto de carnet y actualizar vista previa')
    def post(self, request, cedula: str):
        archivo = request.FILES.get('foto') or request.FILES.get('file')
        if not archivo:
            return fail('No se envió ninguna foto', status=400)

        from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
        from apps.personal.infrastructure.models.personal_models import EmployeeModel

        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not empleado:
            return fail(f"Empleado con cédula {cedula} no encontrado", status=404)

        contenido = archivo.read()
        clave = f"perfiles/{cedula}_{archivo.name}"
        SeaweedFSStorage().subir(clave, contenido, archivo.content_type)
        empleado.profile = clave
        empleado.save(update_fields=['profile'])

        nombre = request.data.get('nombre')
        repo = RepoCarnetizacionORM()
        html = repo.generar_vista_previa(cedula=cedula, nombre_override=nombre, foto_bytes=contenido)
        return ok({"vista_previa": html, "filename": archivo.name, "message": "Foto subida exitosamente"})


class CarnetGenerarView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.emitir')]

    @extend_schema(tags=['Carnetización'], summary='Emitir carnet y descargar PDF generado')
    def post(self, request, cedula: str):
        motivo_id = request.data.get('motivo_id')
        observaciones = request.data.get('observaciones', '')
        datos_editados = request.data.get('datos_editados', {})
        nombre_override = datos_editados.get('nombre') if isinstance(datos_editados, dict) else None

        repo = RepoCarnetizacionORM()
        carnet = repo.emitir_carnet(
            empleado_cedula=cedula,
            motivo_id=int(motivo_id) if motivo_id else 1,
            observaciones=observaciones,
        )
        pdf_bytes = repo.generar_pdf(carnet.id, nombre_override=nombre_override)
        respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
        respuesta['Content-Disposition'] = f'attachment; filename="carnet_{cedula}.pdf"'
        return respuesta
