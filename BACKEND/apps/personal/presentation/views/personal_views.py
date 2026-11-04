"""
Vistas delgadas de Personal (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
from django.http import HttpResponse
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, extend_schema

from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import (
    MAX_BYTES_IMAGEN,
    TIPOS_IMAGEN,
    clave_segura,
    validar_archivo,
)
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso
from apps.personal.application.use_cases.gestionar_personal import (
    actualizar_empleado,
    registrar_empleado,
    guardar_foto,
    obtener_clave_foto,
)
from apps.personal.application.use_cases.listar_personal import listar_personal_paginado
from apps.personal.application.use_cases.obtener_personal import obtener_personal_por_cedula
from apps.personal.infrastructure.mappers.mapper_personal import ruta_foto
from apps.personal.infrastructure.pdf_empleado import construir_pdf_expediente_empleado
from apps.personal.infrastructure.repositories.consultas_historial_cargos import historial_cargos_de
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
    EmpleadoActualizarSerializer,
    EmpleadoCrearSerializer,
)
from apps.personal.presentation.filters.personal_filters import (
    FILTROS_ESTRUCTURA,
    filtros_listado_personal,
    paginacion_listado,
)
from apps.personal.presentation.serializers.personal_serializers import (
    EmpleadoListadoSerializer,
    EmpleadoSerializer,
    ListadoEmpleadosPaginadoSerializer,
)


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
            OpenApiParameter('page', int, description='Página (1-based). Por defecto 1.'),
            OpenApiParameter(
                'page_size', int, description='Tamaño de página (máximo 50). Por defecto 10.'
            ),
            *[OpenApiParameter(nombre, int) for nombre in FILTROS_ESTRUCTURA],
        ],
        responses={200: ListadoEmpleadosPaginadoSerializer},
    )
    def get(self, request):
        repo = RepoPersonalORM()
        paginacion = paginacion_listado(request.query_params)
        dtos, total = listar_personal_paginado(
            repo,
            page=paginacion['page'],
            page_size=paginacion['page_size'],
            **filtros_listado_personal(request.query_params),
        )
        return ok(
            {
                'results': EmpleadoListadoSerializer(dtos, many=True).data,
                'total': total,
                'page': paginacion['page'],
                'page_size': paginacion['page_size'],
            }
        )

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


def _quien_genera(usuario) -> str:
    """«Nombre Apellido (cédula)» del usuario que descarga; solo la cédula si no hay nombre."""
    cedula = str(usuario)
    try:
        emp = usuario.cedula
        nombre = f"{emp.nombres} {emp.apellidos}".strip()
    except Exception:
        return cedula
    return f"{nombre} ({cedula})" if nombre else cedula


def _foto_para_pdf(dto) -> bytes | None:
    """Bytes de la foto del empleado, o None si no tiene o el almacén no responde."""
    clave = dto.profile
    if not clave or clave.startswith(('data:', 'http')):
        return None
    try:
        return SeaweedFSStorage().descargar(clave)
    except Exception:
        return None


class EmpleadoDetallePdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.exportar_pdf')]

    @extend_schema(tags=['Personal'], summary='Exportar el expediente de un empleado activo en PDF')
    def get(self, request, cedula: str):
        repo = RepoPersonalORM()
        dto = obtener_personal_por_cedula(repo, cedula=cedula)
        pdf_bytes = construir_pdf_expediente_empleado(
            dto, usuario_nombre=_quien_genera(request.user), foto_bytes=_foto_para_pdf(dto),
            historial_cargos=historial_cargos_de(cedula),
        )
        return _respuesta_pdf(pdf_bytes, f"expediente-empleado-{cedula}.pdf")


class EmpleadoFotoView(APIView):
    class _PuedeSubirFoto(BasePermission):
        """La foto es un dato de `Employee`: la puede subir RRHH o Pasivos."""

        message = "No posee permiso para actualizar la foto del empleado."

        def has_permission(self, request, view) -> bool:
            return any(
                usuario_tiene_permiso(request.user, codigo)
                for codigo in (
                    'personal.editar_personales',
                    'personal.crear',
                    'pasivos.crear',
                    'pasivos.editar',
                )
            )

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), self._PuedeSubirFoto()]
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
