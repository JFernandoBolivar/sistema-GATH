"""
Servicio de dominio para validación estricta de archivos multimedia de biblioteca (O44 - E4).
Asegura que logos, firmas e imágenes institucionales sean seguros, íntegros y válidos.

B-8: el tipo se deriva del contenido real (magic bytes), nunca del nombre ni del
``Content-Type`` declarado. Los SVG **no se aceptan en subidas nuevas**: ReportLab
no los incrusta en el PDF del carnet y no hay rasterizador instalado; además son
un vector clásico de XSS. Los SVG históricos se sanean al descargarlos
(``apps.carnetizacion.domain.services.svg_seguro``).
"""
from core.domain.exceptions import ValidationError

from .svg_seguro import parece_svg

MAX_SIZE_FIRMA = 2 * 1024 * 1024  # 2 MB
MAX_SIZE_GENERAL = 5 * 1024 * 1024  # 5 MB

MIME_TYPES_PERMITIDOS = {
    "image/png",
    "image/jpeg",
    "image/webp",
}

EXTENSIONES_PERMITIDAS = {".png", ".jpg", ".jpeg", ".webp"}

MIME_POR_EXTENSION = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}

MENSAJE_SVG_NO_SOPORTADO = (
    "Los archivos SVG no se aceptan en la biblioteca: no se pueden incrustar en el "
    "PDF del carnet y pueden contener código activo. Exporte el gráfico como PNG o JPEG."
)


def detectar_mime(contenido: bytes) -> str | None:
    """Tipo real del archivo por sus magic bytes (o ``None`` si no se reconoce).

    Incluye PDF y GIF porque pueden existir medios antiguos ya almacenados; la
    lista de tipos *aceptables en subidas* es ``MIME_TYPES_PERMITIDOS``.
    """
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if (
        len(contenido) >= 12
        and contenido[:4] == b"RIFF"
        and contenido[8:12] == b"WEBP"
    ):
        return "image/webp"
    if contenido.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if contenido.startswith(b"%PDF-"):
        return "application/pdf"
    if parece_svg(contenido):
        return "image/svg+xml"
    return None


def validar_archivo_biblioteca(
    contenido: bytes,
    nombre_archivo: str,
    categoria: str,
    content_type_declarado: str | None = None,
) -> tuple[str, int]:
    """
    Valida tamaño, extensión y tipo real (magic bytes) del archivo.
    Retorna (mime_type_detectado, tamano_bytes).
    Lanza ValidationError si el archivo no cumple los requisitos.

    ``content_type_declarado`` se conserva por compatibilidad de firma, pero se
    ignora deliberadamente: lo envía el cliente y no es confiable.
    """
    del content_type_declarado  # nunca se usa para decidir el tipo

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

    # Validar extensión (solo formatos que el PDF puede incrustar)
    nombre_lower = nombre_archivo.lower()
    extension = next(
        (ext for ext in MIME_POR_EXTENSION if nombre_lower.endswith(ext)),
        None,
    )
    if nombre_lower.endswith(".svg"):
        raise ValidationError(MENSAJE_SVG_NO_SOPORTADO)
    if extension is None:
        raise ValidationError(
            "Extensión de archivo no permitida. Formatos soportados: PNG, JPG, JPEG, WEBP."
        )

    # Detección por firmas binarias (magic numbers)
    mime_detectado = detectar_mime(contenido)
    if mime_detectado == "image/svg+xml":
        raise ValidationError(MENSAJE_SVG_NO_SOPORTADO)
    if mime_detectado not in MIME_TYPES_PERMITIDOS:
        raise ValidationError(
            "El contenido del archivo no corresponde a una imagen válida (PNG, JPG o WebP)."
        )

    # La extensión debe coincidir con el contenido real: evita polyglots y
    # archivos renombrados que terminarían servidos con un tipo incorrecto.
    if MIME_POR_EXTENSION[extension] != mime_detectado:
        raise ValidationError(
            "La extensión del archivo no coincide con su contenido real. "
            f"Se detectó {mime_detectado}."
        )

    return mime_detectado, tamano
