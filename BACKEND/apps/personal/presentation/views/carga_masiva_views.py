"""
Vistas de carga masiva de personal vía Excel (gap #4).
"""
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from core.domain.exceptions import ValidationError
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from apps.personal.infrastructure.importadores.carga_masiva_empleados import importar_empleados_basico
from apps.personal.infrastructure.importadores.carga_masiva_expediente import importar_expediente_completo
from apps.personal.presentation.serializers.carga_masiva_serializers import CargaMasivaArchivoSerializer


class ImportarEmpleadosView(APIView):
    """Réplica de `RAC/views/personal_activo_views.py::ImportEmployeesView`."""
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated, HasPermission('personal.carga_masiva')]

    @extend_schema(
        tags=['Personal'],
        summary='Carga masiva de empleados (datos básicos) vía Excel',
        request=CargaMasivaArchivoSerializer,
    )
    def post(self, request):
        serializer = CargaMasivaArchivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resultado = importar_empleados_basico(serializer.validated_data['archivo'])
        return ok(
            {'procesados': resultado['procesados'], 'errores': resultado['errores']},
            f"Se procesaron {resultado['procesados']} empleados.",
            status=201,
        )


class ImportarExpedienteCompletoView(APIView):
    """
    Réplica de `RAC/views/personal_activo_views.py::ImportFullEmployeeDataView`,
    con la corrección de ALTA-16 (ver docstring de
    `apps/personal/infrastructure/importadores/carga_masiva_expediente.py`).
    """
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated, HasPermission('personal.carga_masiva')]

    @extend_schema(
        tags=['Personal'],
        summary='Carga masiva de expediente completo (vivienda, salud, académico, contrato) vía Excel',
        request=CargaMasivaArchivoSerializer,
    )
    def post(self, request):
        serializer = CargaMasivaArchivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        archivo = serializer.validated_data['archivo']

        try:
            resultado = importar_expediente_completo(archivo, archivo.name)
        except ValidationError as exc:
            return fail(message=str(exc), status=400, data={'detalles': getattr(exc, 'detalles', [])})

        return ok(
            {'creados': resultado['creados'], 'actualizados': resultado['actualizados']},
            'Proceso completado con éxito.',
            status=201,
        )
