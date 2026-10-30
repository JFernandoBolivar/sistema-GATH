"""Verificación PÚBLICA de la constancia (la que abre el QR del documento impreso): sin sesión, con throttle por IP."""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases.consultas import verificar_constancia_publica
from apps.fe_de_vida.infrastructure.repositories.lector_pasivos_orm import LectorPasivosORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    ConstanciaPublicaSerializer,
    a_dict_verificacion_publica,
)
from apps.fe_de_vida.presentation.views._comun import auditar
from core.domain.exceptions import NotFoundError
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

RECURSO_CONSTANCIA = 'ConstanciaFeDeVida'
RECURSO_DESCONOCIDO = 'N/D'  # no se guarda el código consultado: es dato del visitante, sin validar


class VerificarConstanciaPublicaView(APIView):
    authentication_classes = []  # una cookie vencida no debe impedir ver la ficha
    permission_classes = [AllowAny]
    throttle_scope = 'fe_de_vida_verificacion_publica'

    @extend_schema(
        tags=['Fe de vida · Cobertura y verificación'],
        summary='Verificar públicamente una constancia por su código (sin sesión)',
        description=(
            'Para quien escanea el QR del documento. Solo constancias de solicitudes VALIDADA; la cédula va '
            'enmascarada y no se devuelven certificantes, ids internos ni foto. Código inexistente, malformado o de '
            'solicitud no validada: 404 idéntico. Throttle por IP (`fe_de_vida_verificacion_publica`) y auditoría '
            'de cada consulta.'
        ),
        auth=[],
        responses={200: ConstanciaPublicaSerializer, 404: MensajeRespuestaSerializer, 429: MensajeRespuestaSerializer},
    )
    def get(self, request, codigo):
        try:
            v = verificar_constancia_publica(
                RepoConstanciasORM(), RepoSolicitudesFeDeVidaORM(), RepoProcesosORM(), LectorPasivosORM(), codigo=codigo,
            )
        except NotFoundError:
            auditar(
                request, 'CONSTANCIA_VERIFICADA_PUBLICA', RECURSO_DESCONOCIDO, None, None,
                recurso_tipo=RECURSO_CONSTANCIA, resultado=AuditoriaLog.Resultado.FAILED,
            )
            raise
        auditar(request, 'CONSTANCIA_VERIFICADA_PUBLICA', v.numero, None, None, recurso_tipo=RECURSO_CONSTANCIA)
        return ok(a_dict_verificacion_publica(v))
