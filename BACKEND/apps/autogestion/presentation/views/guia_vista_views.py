"""
Vistas de la API para consulta y registro de guías interactivas vistas (O35).
"""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.autogestion.application.use_cases.gestionar_guias_vistas import (
    ConsultarGuiasVistasUseCase,
    MarcarGuiaVistaUseCase,
)
from apps.autogestion.infrastructure.repositories.repo_guia_vista_orm import RepoGuiaVistaORM
from apps.autogestion.infrastructure.serializers.guia_vista_serializers import (
    GuiaVistaSerializer,
    MarcarGuiaVistaInputSerializer,
)
from apps.autogestion.presentation.views._comun import cedula_de_sesion, validar_entrada
from core.presentation.envelope import ok

TAG = ['Autogestión · Guías interactivas']


class GuiasVistasView(APIView):
    """
    GET: Lista las guías interactivas vistas por el usuario autenticado.
    POST: Registra la visualización de una guía y versión para el usuario.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=TAG,
        summary='Consultar guías interactivas vistas por el usuario autenticado',
        responses={200: GuiaVistaSerializer(many=True)},
    )
    def get(self, request):
        cedula = cedula_de_sesion(request)
        repo = RepoGuiaVistaORM()
        use_case = ConsultarGuiasVistasUseCase(repo)
        vistas = use_case.ejecutar(cedula)
        datos = [
            {
                'guia_id': v.guia_id,
                'version': v.version,
                'fecha_vista': v.fecha_vista.isoformat(),
            }
            for v in vistas
        ]
        return ok(datos)

    @extend_schema(
        tags=TAG,
        summary='Marcar una guía interactiva como vista por el usuario autenticado',
        request=MarcarGuiaVistaInputSerializer,
        responses={200: GuiaVistaSerializer},
    )
    def post(self, request):
        cedula = cedula_de_sesion(request)
        datos_validados = validar_entrada(MarcarGuiaVistaInputSerializer, request.data)
        repo = RepoGuiaVistaORM()
        use_case = MarcarGuiaVistaUseCase(repo)
        vista = use_case.ejecutar(
            cedula=cedula,
            guia_id=datos_validados['guia_id'],
            version=datos_validados.get('version', 1),
        )
        return ok({
            'guia_id': vista.guia_id,
            'version': vista.version,
            'fecha_vista': vista.fecha_vista.isoformat(),
        })
