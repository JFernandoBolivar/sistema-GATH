"""
Utilidades de presentación para archivos subidos/servidos (vistas delgadas, B4).

- `validar_archivo`: valida tamaño, extensión y firma (magic bytes) del archivo
  subido. El `Content-Type` del cliente no se confía: se deriva del tipo real.
- `clave_segura`: arma la clave del objeto en el almacenamiento con un UUID;
  nunca se usa `archivo.name` (path traversal / colisiones / caracteres raros).
- `respuesta_archivo`: sirve un objeto del almacenamiento a través de Django
  (la vista que la usa autentica y autoriza); la URL de SeaweedFS (host de la
  red interna) nunca se entrega al navegador.
"""
import uuid
from dataclasses import dataclass

from django.http import StreamingHttpResponse

from core.domain.exceptions import NotFoundError, ValidationError

MAX_BYTES_IMAGEN = 5 * 1024 * 1024
MAX_BYTES_DOCUMENTO = 10 * 1024 * 1024


@dataclass(frozen=True)
class TipoArchivo:
    extensiones: tuple[str, ...]
    mime: str
    firmas: tuple[bytes, ...]


JPEG = TipoArchivo(('.jpg', '.jpeg'), 'image/jpeg', (b'\xff\xd8\xff',))
PNG = TipoArchivo(('.png',), 'image/png', (b'\x89PNG\r\n\x1a\n',))
WEBP = TipoArchivo(('.webp',), 'image/webp', (b'RIFF',))
PDF = TipoArchivo(('.pdf',), 'application/pdf', (b'%PDF-',))

TIPOS_IMAGEN = (JPEG, PNG, WEBP)
TIPOS_DOCUMENTO = (JPEG, PNG, PDF)

# .gif solo se sirve (fotos legadas); no se acepta en subidas nuevas.
_MIME_POR_EXTENSION = {ext: t.mime for t in (JPEG, PNG, WEBP, PDF) for ext in t.extensiones} | {'.gif': 'image/gif'}


def _extension(nombre: str) -> str:
    nombre = (nombre or '').lower()
    return nombre[nombre.rfind('.'):] if '.' in nombre else ''


def validar_archivo(archivo, tipos: tuple[TipoArchivo, ...], max_bytes: int) -> tuple[bytes, TipoArchivo, str]:
    """Retorna (contenido, tipo, extension) o lanza `ValidationError` (400)."""
    if archivo.size > max_bytes:
        raise ValidationError(f"El archivo excede el tamaño máximo de {max_bytes // (1024 * 1024)} MB.")
    ext = _extension(archivo.name)
    tipo = next((t for t in tipos if ext in t.extensiones), None)
    permitidas = ', '.join(e for t in tipos for e in t.extensiones)
    if tipo is None:
        raise ValidationError(f"Tipo de archivo no permitido. Use: {permitidas}.")
    contenido = archivo.read()
    if not any(contenido.startswith(f) for f in tipo.firmas) or (
        tipo is WEBP and contenido[8:12] != b'WEBP'
    ):
        raise ValidationError("El contenido del archivo no corresponde a su extensión.")
    return contenido, tipo, ext


def clave_segura(prefijo: str, extension: str) -> str:
    return f"{prefijo}/{uuid.uuid4().hex}{extension}"


def respuesta_archivo(storage, clave: str, cache: str = 'private, max-age=300') -> StreamingHttpResponse:
    """Sirve el objeto `clave` por streaming; 404 si falta, 503 si el almacén cae."""
    if not clave:
        raise NotFoundError("Archivo no disponible.")
    flujo = storage.descargar_flujo(clave)
    mime = _MIME_POR_EXTENSION.get(_extension(clave), 'application/octet-stream')
    respuesta = StreamingHttpResponse(flujo, content_type=mime)
    respuesta['Cache-Control'] = cache
    respuesta['X-Content-Type-Options'] = 'nosniff'
    return respuesta
