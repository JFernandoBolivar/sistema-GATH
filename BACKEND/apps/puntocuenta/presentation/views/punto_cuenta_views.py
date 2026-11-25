"""Vistas delgadas de Punto de Cuenta y su configuración operativa."""
import uuid
import logging

from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.domain.exceptions import NotFoundError
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

from core.presentation.audit import origen_de_peticion, registrar_auditoria
from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import (
    guardar_configuracion,
    obtener_configuracion_activa,
)
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    listar_puntos_cuenta,
    obtener_punto_cuenta,
    resolver_pdf_para_descarga,
)
from apps.puntocuenta.infrastructure.repositories.repo_documento_generado_orm import RepoDocumentoGeneradoORM
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import RepoConfiguracionPuntoCuentaORM
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import RepoPuntoCuentaORM
from apps.puntocuenta.infrastructure.serializers.punto_cuenta_lectura_serializers import (
    ActualizarConfiguracionPuntoCuentaSerializer,
    ConfiguracionPuntoCuentaSerializer,
    PuntoCuentaSerializer,
)

logger = logging.getLogger('gath.puntocuenta')


class PuntoCuentaListView(APIView):
    """GET /api/v1/puntocuenta/"""

    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(
        tags=['Punto de Cuenta'],
        summary='Listar los puntos de cuenta generados',
        responses={200: PuntoCuentaSerializer(many=True)},
    )
    def get(self, request):
        filtros = {
            'cedula': request.query_params.get('cedula'),
            'oficina_id': request.query_params.get('oficina_id'),
            'fecha_desde': request.query_params.get('fecha_desde'),
            'fecha_hasta': request.query_params.get('fecha_hasta'),
        }
        resultado = listar_puntos_cuenta(RepoPuntoCuentaORM(), filtros=filtros)
        return ok(PuntoCuentaSerializer(resultado, many=True).data)


class PuntoCuentaDocumentoView(APIView):
    """URL de descarga del PDF original; nunca rerenderiza con otra plantilla."""

    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(tags=['Punto de Cuenta'], summary='Obtener la URL de descarga del documento guardado')
    def get(self, request, id):
        repo = RepoPuntoCuentaORM()
        dto = obtener_punto_cuenta(repo, id)
        if dto is None:
            raise NotFoundError(f'Punto de cuenta {id} no encontrado.')
        dto = resolver_pdf_para_descarga(repo, RepoDocumentoGeneradoORM(), dto)
        return ok({'url': reverse('puntocuenta:puntocuenta_documento_archivo', kwargs={'id': str(dto.id)})})


class PuntoCuentaDocumentoArchivoView(APIView):
    """GET /api/v1/puntocuenta/<id>/documento/archivo/ — PDF por streaming."""

    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(
        tags=['Punto de Cuenta'], summary='Descargar el PDF guardado del punto de cuenta',
        responses={200: OpenApiTypes.BINARY},
    )
    def get(self, request, id):
        repo = RepoPuntoCuentaORM()
        dto = obtener_punto_cuenta(repo, id)
        if dto is None:
            raise NotFoundError('El punto de cuenta solicitado no existe.')
        dto = resolver_pdf_para_descarga(repo, RepoDocumentoGeneradoORM(), dto)
        return respuesta_archivo(
            SeaweedFSStorage(), dto.documento_pdf_clave, cache='private, no-store',
            request=request, recurso='punto_cuenta', recurso_id=dto.id,
        )


class PuntoCuentaConfiguracionView(APIView):
    """GET/PUT de procesos habilitados, interruptor y correlativo."""

    permission_classes = [IsAuthenticated, HasPermission('configuracion.editar')]

    @extend_schema(
        tags=['Punto de Cuenta'],
        summary='Obtener configuración operativa de puntos de cuenta',
        responses={200: ConfiguracionPuntoCuentaSerializer},
    )
    def get(self, request):
        cfg = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())
        return ok(ConfiguracionPuntoCuentaSerializer(cfg).data)

    @extend_schema(
        tags=['Punto de Cuenta'],
        summary='Actualizar procesos habilitados de puntos de cuenta',
        request=ActualizarConfiguracionPuntoCuentaSerializer,
        responses={200: ConfiguracionPuntoCuentaSerializer},
    )
    def put(self, request):
        serializer = ActualizarConfiguracionPuntoCuentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resultado = guardar_configuracion(
            serializer.validated_data, usuario_id=request.user.pk, repo=RepoConfiguracionPuntoCuentaORM(),
        )
        usuario = request.user
        registrar_auditoria(
            trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
            actor_id=getattr(usuario, 'pk', None),
            actor_cedula=str(getattr(usuario, 'cedula_id', '') or ''),
            actor_rol=getattr(getattr(usuario, 'rol', None), 'nombre_rol', '') or '',
            accion='puntocuenta.configuracion_actualizada',
            modulo='puntocuenta',
            recurso_tipo='configuracion_punto_cuenta',
            recurso_id=str(resultado.get('id') or ''),
            estado_nuevo={
                'version': resultado.get('version'),
                'cambios': list(serializer.validated_data.keys()),
            },
            **origen_de_peticion(request),
        )
        return ok(ConfiguracionPuntoCuentaSerializer(resultado).data, 'Configuración actualizada correctamente.')
