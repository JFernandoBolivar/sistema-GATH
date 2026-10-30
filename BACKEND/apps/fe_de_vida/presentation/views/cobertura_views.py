"""Vistas de cobertura (C16: pasivos sin correo o sin cuenta) y de verificación interna de la constancia."""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases.consultas import listar_cobertura, verificar_constancia
from apps.fe_de_vida.domain.entities.filtros import FiltroCobertura
from apps.fe_de_vida.infrastructure.repositories.repo_cobertura_orm import RepoCoberturaORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    ConstanciaVerificadaSerializer,
    FiltroCoberturaSerializer,
    PasivoCoberturaSerializer,
    a_dict_cobertura,
    a_dict_constancia,
)
from apps.fe_de_vida.presentation.views._comun import (
    RECURSO_COBERTURA,
    auditar,
    parametros_pagina,
    respuesta_pagina,
    validar_entrada,
)
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Cobertura y verificación']


class CoberturaPasivosView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VER_COBERTURA)

    @extend_schema(
        tags=TAG, summary='Pasivos sin correo o sin cuenta de acceso (paginado y filtrable)',
        description='Sin `sin_correo`/`sin_cuenta` lista a quienes carecen de cualquiera de los dos. Pasivo = su asignación laboral.',
        parameters=[
            OpenApiParameter('texto', str, description='Cédula o nombre'),
            OpenApiParameter('tipo_nomina_id', int, description='Tipo de pensión'),
            OpenApiParameter('sin_correo', bool), OpenApiParameter('sin_cuenta', bool),
            OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'), OpenApiParameter('offset', int),
        ],
        responses={200: PasivoCoberturaSerializer(many=True), 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroCoberturaSerializer, request.query_params)
        limite, desplazamiento = parametros_pagina(filtros)
        filas, total = listar_cobertura(
            RepoCoberturaORM(), limite=limite, desplazamiento=desplazamiento,
            filtro=FiltroCobertura(
                texto=filtros.get('texto'), tipo_nomina_id=filtros.get('tipo_nomina_id'),
                sin_correo=filtros['sin_correo'], sin_cuenta=filtros['sin_cuenta'],
            ),
        )
        auditar(request, 'COBERTURA_CONSULTADA', 'pasivos', None, {'resultados': total}, recurso_tipo=RECURSO_COBERTURA)
        return ok(respuesta_pagina(total, filtros, [a_dict_cobertura(p) for p in filas]))


class VerificarConstanciaView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VERIFICAR_CONSTANCIA)

    @extend_schema(
        tags=TAG, summary='Verificar internamente una constancia por su código (el del QR)',
        responses={200: ConstanciaVerificadaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, codigo):
        constancia = verificar_constancia(RepoConstanciasORM(), codigo=codigo)
        auditar(request, 'CONSTANCIA_VERIFICADA', constancia.solicitud_id, None, {'numero': constancia.numero})
        return ok(a_dict_constancia(constancia))
