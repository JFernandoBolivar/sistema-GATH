"""
Servir archivos del almacenamiento (vistas delgadas, B4).

La validación de subidas vive en `core/infrastructure/storage/validacion_archivo.py`.
`respuesta_archivo` sirve un objeto a través de Django (la vista que la usa
autentica y autoriza); la URL de SeaweedFS (red interna) nunca llega al navegador.
"""
from django.http import StreamingHttpResponse

from core.domain.exceptions import NotFoundError
from core.infrastructure.storage.validacion_archivo import MIME_POR_EXTENSION, extension_de


def respuesta_archivo(storage, clave: str, cache: str = 'private, max-age=300') -> StreamingHttpResponse:
    """Sirve el objeto `clave` por streaming; 404 si falta, 503 si el almacén cae."""
    if not clave:
        raise NotFoundError("Archivo no disponible.")
    flujo = storage.descargar_flujo(clave)
    mime = MIME_POR_EXTENSION.get(extension_de(clave), 'application/octet-stream')
    respuesta = StreamingHttpResponse(flujo, content_type=mime)
    respuesta['Cache-Control'] = cache
    respuesta['X-Content-Type-Options'] = 'nosniff'
    return respuesta
