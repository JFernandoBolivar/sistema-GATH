"""
Vistas delgadas de Personal (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import OpenApiParameter, extend_schema

from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.presentation.archivos import (
    MAX_BYTES_IMAGEN,
    TIPOS_IMAGEN,
    clave_segura,
    respuesta_archivo,
    validar_archivo,
)
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from apps.personal.application.use_cases.gestionar_personal import (
    actualizar_empleado,
    registrar_empleado,
    guardar_foto,
    obtener_clave_foto,
)
from apps.personal.application.use_cases.listar_personal import listar_personal
from apps.personal.application.use_cases.obtener_personal import obtener_personal_por_cedula
from apps.personal.infrastructure.mappers.mapper_personal import ruta_foto
from apps.personal.infrastructure.pdf_empleado import construir_pdf_expediente_empleado
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
    EmpleadoActualizarSerializer,
    EmpleadoCrearSerializer,
)
from apps.personal.presentation.filters.personal_filters import FILTROS_ESTRUCTURA, filtros_listado_personal
from apps.personal.presentation.serializers.personal_serializers import EmpleadoSerializer


def _respuesta_pdf(pdf_bytes: bytes, nombre_archivo: str) -> HttpResponse:
    respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    return respuesta


class EmpleadosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.ver')]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('personal.crear')()]
        return [IsAuthenticated(), HasPermission('personal.ver')()]

    @extend_schema(
        tags=['Personal'],
        summary='Listar expediente de empleados activos con búsqueda y filtros por estructura organizativa',
        parameters=[
            OpenApiParameter('q', str, description='Cédula, nombres o apellidos'),
            OpenApiParameter('codigo', str),
            OpenApiParameter('tipo_nomina', int),
            *[OpenApiParameter(nombre, int) for nombre in FILTROS_ESTRUCTURA],
        ],
        responses={200: EmpleadoSerializer(many=True)},
    )
    def get(self, request):
        repo = RepoPersonalORM()
        dtos = listar_personal(repo, **filtros_listado_personal(request.query_params))
        return ok(EmpleadoSerializer(dtos, many=True).data)

    @extend_schema(
        tags=['Personal'],
        summary='Registrar nuevo trabajador (con datos anidados: vivienda, salud, académico, contrato)',
        request=EmpleadoCrearSerializer,
        responses={200: EmpleadoSerializer},
    )
    def post(self, request):
        serializer = EmpleadoCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoPersonalORM()
        dto = registrar_empleado(repo, datos=serializer.validated_data)
        return ok(EmpleadoSerializer(dto).data, 'Empleado registrado correctamente.', status=201)


class EmpleadoDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.ver')]

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission('personal.editar_personales')()]
        return [IsAuthenticated(), HasPermission('personal.ver_detalle')()]

    @extend_schema(tags=['Personal'], summary='Obtener expediente de empleado por cédula', responses={200: EmpleadoSerializer})
    def get(self, request, cedula: str):
        repo = RepoPersonalORM()
        dto = obtener_personal_por_cedula(repo, cedula=cedula)
        return ok(EmpleadoSerializer(dto).data)

    @extend_schema(
        tags=['Personal'],
        summary='Actualizar datos de empleado (con datos anidados)',
        request=EmpleadoActualizarSerializer,
        responses={200: EmpleadoSerializer},
    )
    def put(self, request, cedula: str):
        serializer = EmpleadoActualizarSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        repo = RepoPersonalORM()
        dto = actualizar_empleado(repo, cedula=cedula, datos=serializer.validated_data)
        return ok(EmpleadoSerializer(dto).data, 'Empleado actualizado correctamente.')

    # El legado (`RAC/views/personal_activo_views.py::update_employee`) expone
    # esta acción por PATCH; se replica el verbo aquí además de PUT para no
    # forzar al frontend a elegir uno solo mientras dura la migración.
    patch = put


class EmpleadoDetallePdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.exportar_pdf')]

    @extend_schema(tags=['Personal'], summary='Exportar el expediente de un empleado activo en PDF')
    def get(self, request, cedula: str):
        repo = RepoPersonalORM()
        dto = obtener_personal_por_cedula(repo, cedula=cedula)
        pdf_bytes = construir_pdf_expediente_empleado(dto, usuario_nombre=str(request.user))
        return _respuesta_pdf(pdf_bytes, f"expediente-empleado-{cedula}.pdf")


class EmpleadoFotoView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('personal.editar_personales')()]
        return [IsAuthenticated()]

    @extend_schema(tags=['Personal'], summary='Obtener fotografía de perfil del empleado (binario)')
    def get(self, request, cedula: str):
        clave = obtener_clave_foto(RepoPersonalORM(), cedula=cedula)
        return respuesta_archivo(SeaweedFSStorage(), clave, cache='private, max-age=86400')

    @extend_schema(tags=['Personal'], summary='Subir o actualizar foto de perfil de empleado')
    def post(self, request, cedula: str):
        archivo = request.FILES.get('file') or request.FILES.get('foto')
        if not archivo:
            return fail('No se proporcionó ningún archivo', status=400)

        contenido, tipo, ext = validar_archivo(archivo, TIPOS_IMAGEN, MAX_BYTES_IMAGEN)
        clave = clave_segura('perfiles', ext)
        SeaweedFSStorage().subir(clave, contenido, tipo.mime)

        guardar_foto(RepoPersonalORM(), cedula=cedula, clave=clave)

        return ok({'clave': clave, 'url': ruta_foto(cedula, clave), 'mensaje': 'Foto de perfil actualizada exitosamente'})
