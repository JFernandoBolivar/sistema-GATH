"""
Servicio autenticado de archivos de MEDIA_ROOT en Core Presentation (B0.7, B26).
"""
import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated


_TIPOS_INLINE = frozenset({
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
})

_PREFIJOS_DENEGADOS = ('familiares',)


def _resolver_ruta_media(ruta_solicitada):
    if not ruta_solicitada:
        raise Http404("Archivo no encontrado.")

    if '\x00' in ruta_solicitada:
        raise Http404("Archivo no encontrado.")

    ruta = ruta_solicitada.replace('\\', '/')

    if ruta.startswith('/') or ruta.startswith('~'):
        raise Http404("Archivo no encontrado.")

    componentes = []
    for componente in ruta.split('/'):
        if componente in ('', '.'):
            continue
        if componente == '..':
            raise Http404("Archivo no encontrado.")
        componentes.append(componente)

    if not componentes:
        raise Http404("Archivo no encontrado.")

    if componentes[0].strip().lower() in _PREFIJOS_DENEGADOS:
        raise Http404("Archivo no encontrado.")

    base = Path(settings.MEDIA_ROOT).resolve(strict=False)
    destino = base.joinpath(*componentes).resolve(strict=False)

    try:
        destino.relative_to(base)
    except ValueError:
        raise Http404("Archivo no encontrado.")

    if not destino.is_file():
        raise Http404("Archivo no encontrado.")

    return destino


@extend_schema(
    tags=["Archivos"],
    summary="Servir un archivo de MEDIA_ROOT",
    description="Entrega por streaming un archivo almacenado en MEDIA_ROOT de forma autenticada.",
    parameters=[
        OpenApiParameter(
            name='ruta',
            location=OpenApiParameter.PATH,
            description='Ruta relativa del archivo dentro de MEDIA_ROOT.',
            required=True,
            type=str,
        ),
    ],
    responses={200: OpenApiTypes.BINARY, 401: None, 404: None},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def servir_archivo_media(request, ruta):
    destino = _resolver_ruta_media(ruta)

    tipo_contenido, _ = mimetypes.guess_type(destino.name)
    tipo_contenido = tipo_contenido or 'application/octet-stream'
    como_adjunto = tipo_contenido not in _TIPOS_INLINE

    try:
        manejador = destino.open('rb')
    except OSError:
        raise Http404("Archivo no encontrado.")

    respuesta = FileResponse(
        manejador,
        as_attachment=como_adjunto,
        filename=destino.name,
        content_type=tipo_contenido,
    )
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    respuesta['Referrer-Policy'] = 'no-referrer'
    return respuesta
