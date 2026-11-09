"""
Estado y descarga de las exportaciones asíncronas.

Ambas rutas exigen sesión y solo responden al usuario que pidió la exportación
(otro usuario recibe 404, igual que un id inexistente). La descarga se sirve por
streaming desde Django: el navegador nunca recibe una URL del almacén de objetos.
"""
from datetime import datetime, timezone

from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.exportaciones.application.use_cases.gestionar_exportaciones import (
    consultar_exportacion,
    obtener_descarga,
)
from apps.exportaciones.domain.value_objects.tipos_exportacion import TIPO_CONTENIDO
from apps.exportaciones.infrastructure.repositories.repo_exportaciones_orm import (
    RepoExportacionesORM,
)
from apps.exportaciones.presentation.serializers.exportaciones_serializers import (
    TrabajoExportacionSerializer,
)
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.presentation.descargas import aplicar_cabeceras_de_truncado
from core.presentation.envelope import ok


class EstadoExportacionView(APIView):
    """GET /api/v1/exportaciones/<id>/ — PENDIENTE, EN_PROCESO (con %), LISTO, ERROR o EXPIRADO."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Exportaciones'], summary='Estado de una exportación asíncrona',
        responses={200: TrabajoExportacionSerializer},
    )
    def get(self, request, trabajo_id: str):
        trabajo = consultar_exportacion(RepoExportacionesORM(), trabajo_id, request.user.pk)
        return ok(TrabajoExportacionSerializer(trabajo).data)


class DescargarExportacionView(APIView):
    """GET /api/v1/exportaciones/<id>/descargar/ — el archivo, solo para quien lo pidió."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Exportaciones'], summary='Descargar el archivo de una exportación lista',
        responses={200: OpenApiTypes.BINARY},
    )
    def get(self, request, trabajo_id: str):
        trabajo, flujo = obtener_descarga(
            RepoExportacionesORM(), SeaweedFSStorage(), trabajo_id, request.user.pk,
            datetime.now(timezone.utc),
        )
        respuesta = StreamingHttpResponse(flujo, content_type=TIPO_CONTENIDO[trabajo.formato])
        respuesta['Content-Disposition'] = f'attachment; filename="{trabajo.nombre_archivo}"'
        respuesta['Content-Length'] = str(trabajo.tamano_bytes)
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Cache-Control'] = 'private, no-store'
        aplicar_cabeceras_de_truncado(
            respuesta,
            total_encontrados=int(trabajo.metadatos.get('total_encontrados') or 0),
            limite=int(trabajo.metadatos.get('limite') or 0),
            truncado=bool(trabajo.metadatos.get('truncado')),
        )
        return respuesta
