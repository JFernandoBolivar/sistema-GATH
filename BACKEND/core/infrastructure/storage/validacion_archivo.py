"""
Validación de archivos subidos (infraestructura, Etapa A5).

- `validar_archivo`: valida tamaño, extensión y firma real (magic bytes). El
  `Content-Type` del cliente no se confía: el tipo se deriva del contenido.
  Sirve para fotos JPG/PNG (selfie de fe de vida, perfiles) y soportes PDF.
- `clave_segura`: clave del objeto en el almacenamiento con UUID; nunca se usa
  `archivo.name` (path traversal / colisiones / caracteres raros).

La capa de presentación solo invoca estas funciones (ver `core/presentation/archivos.py`
para servir objetos).
"""
import uuid
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

MAX_BYTES_IMAGEN = 5 * 1024 * 1024
MAX_BYTES_DOCUMENTO = 10 * 1024 * 1024
MAX_BYTES_FOTO = MAX_BYTES_IMAGEN
MAX_BYTES_SOPORTE = MAX_BYTES_DOCUMENTO


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
# Fe de vida: selfie con la cédula (JPG/PNG, sin WebP ni PDF) y soportes (títulos, actas: PDF o imagen).
TIPOS_FOTO = (JPEG, PNG)
TIPOS_SOPORTE = (PDF, JPEG, PNG)

# .gif solo se sirve (fotos legadas); no se acepta en subidas nuevas.
MIME_POR_EXTENSION = {ext: t.mime for t in (JPEG, PNG, WEBP, PDF) for ext in t.extensiones} | {'.gif': 'image/gif'}


def extension_de(nombre: str) -> str:
    nombre = (nombre or '').lower()
    return nombre[nombre.rfind('.'):] if '.' in nombre else ''


def validar_archivo(archivo, tipos: tuple[TipoArchivo, ...], max_bytes: int) -> tuple[bytes, TipoArchivo, str]:
    """Retorna (contenido, tipo, extension) o lanza `ValidationError` (400)."""
    if archivo.size > max_bytes:
        raise ValidationError(f"El archivo excede el tamaño máximo de {max_bytes // (1024 * 1024)} MB.")
    ext = extension_de(archivo.name)
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
