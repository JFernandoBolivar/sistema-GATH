"""
Servicio de dominio para validación estricta de archivos multimedia de biblioteca (O44 - E4).
Asegura que logos, firmas e imágenes institucionales sean seguros, íntegros y válidos.
"""
import re
from core.domain.exceptions import ValidationError

MAX_SIZE_FIRMA = 2 * 1024 * 1024  # 2 MB
MAX_SIZE_GENERAL = 5 * 1024 * 1024  # 5 MB

MIME_TYPES_PERMITIDOS = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
}

EXTENSIONES_PERMITIDAS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}


def validar_archivo_biblioteca(
    contenido: bytes,
    nombre_archivo: str,
    categoria: str,
    content_type_declarado: str | None = None,
) -> tuple[str, int]:
    """
    Valida tamaño, firma binaria (magic bytes) y seguridad contra scripts maliciosos.
    Retorna (mime_type_detectado, tamano_bytes).
    Lanza ValidationError si el archivo no cumple los requisitos.
    """
    tamano = len(contenido)
    if tamano == 0:
        raise ValidationError("El archivo subido está vacío.")

    # Validar límite de tamaño según categoría
    limite = MAX_SIZE_FIRMA if categoria == "firma" else MAX_SIZE_GENERAL
    if tamano > limite:
        mb_limite = limite // (1024 * 1024)
        raise ValidationError(
            f"El archivo supera el tamaño máximo permitido de {mb_limite}MB para {categoria}s."
        )

    # Validar extensión
    nombre_lower = nombre_archivo.lower()
    if not any(nombre_lower.endswith(ext) for ext in EXTENSIONES_PERMITIDAS):
        raise ValidationError(
            "Extensión de archivo no permitida. Formatos soportados: PNG, JPG, WEBP, SVG."
        )

    # Detección por firmas binarias (magic numbers)
    mime_detectado = None
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        mime_detectado = "image/png"
    elif contenido.startswith(b"\xff\xd8\xff"):
        mime_detectado = "image/jpeg"
    elif contenido.startswith(b"RIFF") and b"WEBP" in contenido[:16]:
        mime_detectado = "image/webp"
    elif _es_svg_valido(contenido):
        mime_detectado = "image/svg+xml"
    else:
        raise ValidationError(
            "El contenido del archivo no corresponde a una imagen válida (PNG, JPG, WebP o SVG)."
        )

    return mime_detectado, tamano


def _es_svg_valido(contenido: bytes) -> bool:
    """Verifica estructura SVG y previene XSS / inyecciones de script."""
    try:
        texto = contenido.decode("utf-8", errors="ignore").strip().lower()
    except Exception:
        return False

    if "<svg" not in texto:
        return False

    # Lista negra de vectores comunes de XSS en SVG
    patrones_peligrosos = [
        r"<script",
        r"javascript:",
        r"onload\s*=",
        r"onerror\s*=",
        r"onclick\s*=",
        r"onmouseover\s*=",
        r"<foreignobject",
        r"<iframe",
        r"<embed",
    ]
    for patron in patrones_peligrosos:
        if re.search(patron, texto):
            raise ValidationError("El archivo SVG contiene scripts o atributos dinámicos no permitidos.")

    return True
