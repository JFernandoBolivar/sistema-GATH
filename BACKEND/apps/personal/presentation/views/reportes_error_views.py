"""
Vistas DRF para Reportes de Error en Datos Laborales (D20 / Tarea A11 / D-10).
"""
import uuid
from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.personal.application.dtos.reporte_error_dtos import (
    AtenderReporteErrorDTO,
    CrearReporteErrorDTO,
)
from apps.personal.application.use_cases.gestionar_reportes_error_laboral import (
    atender_reporte_error_laboral,
    listar_reportes_error_laboral,
    obtener_reporte_error_laboral,
)
from apps.personal.application.use_cases.reportar_error_laboral import (
    crear_reporte_error_laboral,
)
from apps.personal.infrastructure.repositories.repo_reportes_error_orm import (
    RepoReportesErrorLaboralORM,
)
from apps.personal.presentation.serializers.reportes_error_serializers import (
    AtenderReporteErrorSerializer,
    CrearReporteErrorSerializer,
    ReporteErrorLecturaSerializer,
)
from core.domain.exceptions import NotFoundError, ValidationError
from core.infrastructure.providers import obtener_notificador
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission

PERMISO_REPORTES_ERROR_VER = 'personal.reportes_error_ver'


def _nombre_de_trabajador(cedula: str) -> str:
    """Nombre y apellidos del trabajador, leídos por el repositorio (sin ORM aquí)."""
    return RepoReportesErrorLaboralORM().nombre_trabajador(cedula)


class ReportarErrorLaboralView(APIView):
    """
    Endpoint para que el trabajador autenticado reporte un error en sus datos
    laborales desde «Mi ficha» o consulte el historial de sus propios reportes.
    """
    permission_classes = [IsAuthenticated]

    def _obtener_cedula_trabajador(self, request) -> str:
        cedula = getattr(request.user, 'cedula_id', None) or getattr(request.user, 'cedula', None)
        return str(cedula or '').strip()

    @extend_schema(
        tags=['Personal - Reportes Error'],
        summary='Crear reporte de error en datos laborales',
        description='El trabajador reporta una discrepancia en su cargo, oficina, fecha de ingreso u otro dato laboral.',
        request=CrearReporteErrorSerializer,
        responses={201: ReporteErrorLecturaSerializer, 400: None},
    )
    def post(self, request):
        cedula = self._obtener_cedula_trabajador(request)
        if not cedula:
            return fail("Usuario sin cédula asociada no puede reportar errores laborales.", status.HTTP_400_BAD_REQUEST)

        serializer = CrearReporteErrorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nombre = _nombre_de_trabajador(cedula)
        dto = CrearReporteErrorDTO(
            trabajador_cedula=cedula,
            dato=serializer.validated_data['dato'],
            descripcion=serializer.validated_data['descripcion'],
        )

        notificador = obtener_notificador()
        notificador_fn = notificador.notificar if notificador else None

        repo = RepoReportesErrorLaboralORM()
        try:
            reporte = crear_reporte_error_laboral(
                repo,
                dto=dto,
                trabajador_nombre=nombre,
                notificador_fn=notificador_fn,
            )
        except ValidationError as e:
            return fail(str(e), status.HTTP_400_BAD_REQUEST)

        meta = origen_de_peticion(request)
        registrar_auditoria(
            trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
            actor_id=request.user.pk,
            actor_cedula=cedula,
            actor_rol=getattr(getattr(request.user, 'rol', None), 'nombre_rol', ''),
            accion='personal.reporte_error_laboral_creado',
            modulo='personal',
            recurso_tipo='reporte_error_laboral',
            recurso_id=str(reporte.id),
            ip_origen=meta.get('ip_origen'),
            user_agent=meta.get('user_agent', ''),
            dispositivo=meta.get('dispositivo', 'DESCONOCIDO'),
            estado_nuevo={
                'dato': reporte.dato.value,
                'descripcion': reporte.descripcion,
                'estado': reporte.estado.value,
            },
        )

        data = ReporteErrorLecturaSerializer(reporte).data
        return ok(data, "Reporte de error enviado a Talento Humano exitosamente.", status.HTTP_201_CREATED)

    @extend_schema(
        tags=['Personal - Reportes Error'],
        summary='Consultar mis reportes de error laboral',
        description='Lista los reportes de error laboral generados por el trabajador autenticado.',
        responses={200: ReporteErrorLecturaSerializer(many=True)},
    )
    def get(self, request):
        cedula = self._obtener_cedula_trabajador(request)
        if not cedula:
            return ok({'items': [], 'total': 0}, "No posee cédula vinculada.")

        repo = RepoReportesErrorLaboralORM()
        reportes, total = listar_reportes_error_laboral(repo, trabajador_cedula=cedula, limite=100)
        data = {
            'items': ReporteErrorLecturaSerializer(reportes, many=True).data,
            'total': total,
        }
        return ok(data, "Reportes del trabajador obtenidos exitosamente.")


class ListarReportesErrorLaboralView(APIView):
    """
    Listado general de reportes de error laboral para analistas de Talento Humano.
    Requiere permiso `personal.reportes_error_ver`.
    """
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_REPORTES_ERROR_VER)]

    @extend_schema(
        tags=['Personal - Reportes Error'],
        summary='Listar reportes de error laboral (RRHH)',
        description='Lista paginada de todos los reportes de error laboral con filtros por estado, dato o búsqueda.',
        responses={200: ReporteErrorLecturaSerializer(many=True)},
    )
    def get(self, request):
        estado = request.query_params.get('estado')
        dato = request.query_params.get('dato')
        texto = request.query_params.get('texto') or request.query_params.get('q')

        try:
            limite = min(max(int(request.query_params.get('limit', 20)), 1), 100)
            desplazamiento = max(int(request.query_params.get('offset', 0)), 0)
        except (ValueError, TypeError):
            limite, desplazamiento = 20, 0

        repo = RepoReportesErrorLaboralORM()
        reportes, total = listar_reportes_error_laboral(
            repo,
            estado=estado,
            dato=dato,
            texto_busqueda=texto,
            limite=limite,
            desplazamiento=desplazamiento,
        )

        data = {
            'items': ReporteErrorLecturaSerializer(reportes, many=True).data,
            'total': total,
            'limit': limite,
            'offset': desplazamiento,
        }
        return ok(data, "Reportes de error laboral recuperados exitosamente.")


class AtenderReporteErrorLaboralView(APIView):
    """
    Marca un reporte de error como atendido por el funcionario de RRHH.
    Requiere permiso `personal.reportes_error_ver`.
    """
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_REPORTES_ERROR_VER)]

    @extend_schema(
        tags=['Personal - Reportes Error'],
        summary='Marcar reporte de error laboral como atendido',
        description='Registra la atención del reporte por parte del analista de Talento Humano.',
        request=AtenderReporteErrorSerializer,
        responses={200: ReporteErrorLecturaSerializer, 400: None, 404: None},
    )
    def post(self, request, pk):
        try:
            reporte_id = UUID(str(pk))
        except (ValueError, TypeError):
            return fail("Identificador de reporte inválido.", status.HTTP_400_BAD_REQUEST)

        serializer = AtenderReporteErrorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        funcionario_cedula = str(getattr(request.user, 'cedula_id', None) or getattr(request.user, 'cedula', None) or '').strip()
        funcionario_nombre = _nombre_de_trabajador(funcionario_cedula)
        if not funcionario_nombre:
            funcionario_nombre = str(getattr(request.user, 'username', 'Analista RRHH'))

        dto = AtenderReporteErrorDTO(
            reporte_id=reporte_id,
            funcionario_id=request.user.pk,
            funcionario_cedula=funcionario_cedula,
            funcionario_nombre=funcionario_nombre,
            observacion=serializer.validated_data.get('observacion', ''),
        )

        repo = RepoReportesErrorLaboralORM()
        try:
            reporte_atendido = atender_reporte_error_laboral(repo, dto)
        except NotFoundError as e:
            return fail(str(e), status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return fail(str(e), status.HTTP_400_BAD_REQUEST)

        meta = origen_de_peticion(request)
        registrar_auditoria(
            trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
            actor_id=request.user.pk,
            actor_cedula=funcionario_cedula,
            actor_rol=getattr(getattr(request.user, 'rol', None), 'nombre_rol', ''),
            accion='personal.reporte_error_laboral_atendido',
            modulo='personal',
            recurso_tipo='reporte_error_laboral',
            recurso_id=str(reporte_atendido.id),
            ip_origen=meta.get('ip_origen'),
            user_agent=meta.get('user_agent', ''),
            dispositivo=meta.get('dispositivo', 'DESCONOCIDO'),
            estado_nuevo={
                'estado': reporte_atendido.estado.value,
                'atendido_por_cedula': funcionario_cedula,
                'observacion': reporte_atendido.observacion_atencion,
            },
        )

        data = ReporteErrorLecturaSerializer(reporte_atendido).data
        return ok(data, "Reporte de error marcado como atendido exitosamente.")
