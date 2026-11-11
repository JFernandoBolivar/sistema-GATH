import uuid
"""
Vistas delgadas de Punto de Cuenta y su Configuración (Reglas B4, B7).
Envelope unificado `ok()` / `fail()` y permisos PBAC.
"""
import logging

from django.http import HttpResponse
from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.domain.exceptions import AlmacenamientoNoDisponible, NotFoundError
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

from core.presentation.audit import origen_de_peticion, registrar_auditoria
from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import (
    guardar_configuracion,
    obtener_configuracion_activa,
)
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    listar_puntos_cuenta,
    obtener_punto_cuenta,
)
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import (
    construir_pdf_punto_cuenta,
    generar_vista_previa_pdf,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoConfiguracionPuntoCuentaORM,
)
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
    """
    GET /api/v1/puntocuenta/<id>/documento/ — ruta de descarga (`.../archivo/`).
    Si el PDF automático no existe, lo regenera bajo demanda de manera leniente.
    """
    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(tags=['Punto de Cuenta'], summary='Obtener la URL de descarga del documento (lo regenera si hace falta)')
    def get(self, request, id):
        repo = RepoPuntoCuentaORM()
        dto = obtener_punto_cuenta(repo, id)
        if dto is None:
            raise NotFoundError(f"Punto de cuenta {id} no encontrado.")

        if not dto.documento_generado:
            try:
                pdf_bytes = construir_pdf_punto_cuenta(dto)
                clave = f"puntocuenta/{dto.id}.pdf"
                SeaweedFSStorage().subir(clave, pdf_bytes, 'application/pdf')
                dto = adjuntar_documento_punto_cuenta(repo, dto.id, clave)
            except AlmacenamientoNoDisponible:
                return fail("El documento no pudo generarse: el almacenamiento no está disponible en este momento.", status=503)

        return ok({'url': reverse('puntocuenta:puntocuenta_documento_archivo', kwargs={'id': str(dto.id)})})


class PuntoCuentaDocumentoArchivoView(APIView):
    """GET /api/v1/puntocuenta/<id>/documento/archivo/ — PDF por streaming (autenticado)."""
    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(tags=['Punto de Cuenta'], summary='Descargar el PDF del punto de cuenta (binario)',
                   responses={200: OpenApiTypes.BINARY})
    def get(self, request, id):
        dto = obtener_punto_cuenta(RepoPuntoCuentaORM(), id)
        if dto is None:
            raise NotFoundError("El punto de cuenta solicitado no existe.")
        if not dto.documento_pdf_clave:
            # Reintenta generar si no estaba creado
            try:
                pdf_bytes = construir_pdf_punto_cuenta(dto)
                clave = f"puntocuenta/{dto.id}.pdf"
                SeaweedFSStorage().subir(clave, pdf_bytes, 'application/pdf')
                dto = adjuntar_documento_punto_cuenta(RepoPuntoCuentaORM(), dto.id, clave)
            except Exception:
                # A2-14: un fallo del generador o del almacén no es «no existe» (404);
                # se registra y sube al handler como error de servidor.
                logger.exception('No se pudo generar o guardar el PDF del punto de cuenta %s', dto.id)
                raise
        return respuesta_archivo(SeaweedFSStorage(), dto.documento_pdf_clave, cache='private, no-store')


class PuntoCuentaConfiguracionView(APIView):
    """
    GET /api/v1/puntocuenta/configuracion/
    PUT /api/v1/puntocuenta/configuracion/
    """
    permission_classes = [IsAuthenticated, HasPermission('configuracion.editar')]

    @extend_schema(
        tags=['Punto de Cuenta'],
        summary='Obtener configuración actual de puntos de cuenta',
        responses={200: ConfiguracionPuntoCuentaSerializer},
    )
    def get(self, request):
        cfg = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())
        return ok(ConfiguracionPuntoCuentaSerializer(cfg).data)

    @extend_schema(
        tags=['Punto de Cuenta'],
        summary='Actualizar configuración de puntos de cuenta',
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
            recurso_id=str(resultado.get('version') or ''),
            estado_nuevo={'version': resultado.get('version'), 'cambios': list(serializer.validated_data.keys())},
            **origen_de_peticion(request),
        )

        return ok(ConfiguracionPuntoCuentaSerializer(resultado).data, 'Configuración actualizada correctamente.')


class PuntoCuentaVistaPreviaPdfView(APIView):
    """POST /api/v1/puntocuenta/configuracion/vista-previa/ — genera PDF de prueba con datos del body."""
    permission_classes = [IsAuthenticated, HasPermission('configuracion.editar')]

    @extend_schema(
        tags=['Punto de Cuenta'],
        summary='Generar vista previa en PDF de la plantilla de punto de cuenta',
        request=ActualizarConfiguracionPuntoCuentaSerializer,
        responses={200: OpenApiTypes.BINARY},
    )
    def post(self, request):
        serializer = ActualizarConfiguracionPuntoCuentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        proceso = serializer.validated_data.get('proceso') or request.query_params.get('proceso')
        pdf_bytes = generar_vista_previa_pdf(serializer.validated_data, proceso=proceso)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="vista_previa_punto_cuenta.pdf"'
        return response
