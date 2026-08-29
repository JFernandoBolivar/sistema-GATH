"""
Vista de catálogo de departamentos.
"""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.identidad.application.use_cases.listar_departamentos import (
    listar_departamentos,
)
from apps.identidad.infrastructure.repositories.repo_departamentos_orm import (
    RepoDepartamentosORM,
)
from apps.identidad.infrastructure.serializers.departamento_serializers import (
    DepartamentoLecturaSerializer,
)
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer


class DepartamentoListView(APIView):
    """GET /api/v1/identidad/departamentos/ — catálogo completo."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Identidad'],
        summary='Lista los departamentos',
        responses={200: DepartamentoLecturaSerializer(many=True), 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        departamentos = listar_departamentos(RepoDepartamentosORM())
        datos = DepartamentoLecturaSerializer(departamentos, many=True).data
        return ok(datos, 'Departamentos listados correctamente.')
