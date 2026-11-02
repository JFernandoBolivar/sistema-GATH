"""
Vista de carga masiva de cargos especiales vía Excel (gap #4).
"""
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from core.domain.exceptions import ValidationError
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from apps.cargos.infrastructure.importadores.carga_masiva_cargos_especiales import importar_cargos_especiales
from apps.cargos.presentation.serializers.cargos_serializers import CargaMasivaCargosArchivoSerializer


class ImportarCargosEspecialesView(APIView):
    """Réplica de `RAC/views/personal_activo_views.py::ImportarCargosESPECIALESView`."""
    parser_classes = [MultiPartParser]
    # Se usa el mismo permiso que los otros 2 importadores de Excel de esta
    # migración (`ImportarEmpleadosView`/`ImportarExpedienteCompletoView` en
    # `apps.personal`): "carga masiva" es una capacidad transversal, no
    # ligada solo al catálogo de cargos.
    permission_classes = [IsAuthenticated, HasPermission('personal.carga_masiva')]

    @extend_schema(
        tags=['Cargos'],
        summary='Carga masiva de cargos especiales vía Excel',
        request=CargaMasivaCargosArchivoSerializer,
    )
    def post(self, request):
        serializer = CargaMasivaCargosArchivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        archivo = serializer.validated_data['archivo']

        try:
            resultado = importar_cargos_especiales(archivo, archivo.name)
        except ValidationError as exc:
            return fail(message=str(exc), status=400, data={'detalles': getattr(exc, 'detalles', [])})

        return ok({'creados': resultado['creados']}, f"Se crearon {resultado['creados']} registros con éxito.", status=201)
