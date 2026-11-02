"""
Vistas delgadas de Punto de Cuenta (Reglas B4, B7).

Solo lectura (el registro se genera automáticamente desde el receiver, no
hay endpoint de creación manual): listado para Contabilidad y descarga del
documento (regenerándolo bajo demanda si la generación automática falló —
diseño leniente: ver `infrastructure/receivers.py`).
"""
import logging

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

from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    listar_puntos_cuenta,
    obtener_punto_cuenta,
)
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import construir_pdf_punto_cuenta
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import RepoPuntoCuentaORM
from apps.puntocuenta.infrastructure.serializers.punto_cuenta_lectura_serializers import PuntoCuentaSerializer

logger = logging.getLogger('gath.puntocuenta')


class PuntoCuentaListView(APIView):
    """GET /api/v1/puntocuenta/"""
    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(tags=['Punto de Cuenta'], summary='Listar los puntos de cuenta generados',
                   responses={200: PuntoCuentaSerializer(many=True)})
    def get(self, request):
        resultado = listar_puntos_cuenta(RepoPuntoCuentaORM())
        return ok(PuntoCuentaSerializer(resultado, many=True).data)


class PuntoCuentaDocumentoView(APIView):
    """
    GET /api/v1/puntocuenta/<int:id>/documento/ — ruta de descarga (`.../archivo/`).
    Si el PDF automático falló al crearse (`documento_pdf_clave is None`),
    lo regenera en este momento (leniente: la creación del registro ya
    quedó garantizada antes; esto solo reintenta la parte secundaria).
    """
    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(tags=['Punto de Cuenta'], summary='Obtener la URL de descarga del documento (lo regenera si hace falta)')
    def get(self, request, id: int):
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

        return ok({'url': reverse('puntocuenta:puntocuenta_documento_archivo', kwargs={'id': dto.id})})


class PuntoCuentaDocumentoArchivoView(APIView):
    """GET /api/v1/puntocuenta/<int:id>/documento/archivo/ — PDF por streaming (autenticado)."""
    permission_classes = [IsAuthenticated, HasPermission('puntocuenta.ver')]

    @extend_schema(tags=['Punto de Cuenta'], summary='Descargar el PDF del punto de cuenta (binario)',
                   responses={200: OpenApiTypes.BINARY})
    def get(self, request, id: int):
        dto = obtener_punto_cuenta(RepoPuntoCuentaORM(), id)
        if dto is None or not dto.documento_pdf_clave:
            raise NotFoundError("El documento del punto de cuenta no está disponible.")
        return respuesta_archivo(SeaweedFSStorage(), dto.documento_pdf_clave, cache='private, no-store')
