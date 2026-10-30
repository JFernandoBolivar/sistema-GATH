"""
Saneamiento de la selfie con la cédula (PLAN §2.6.4): se decodifica y se RE-CODIFICA con Pillow para
descartar polyglots y borrar EXIF/GPS, y se exige una dimensión mínima (calidad mínima).
"""
from io import BytesIO

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError

from core.domain.exceptions import ValidationError

FORMATOS = {'image/jpeg': ('JPEG', {'quality': 90}), 'image/png': ('PNG', {})}


def sanear_imagen(contenido: bytes, mime: str) -> bytes:
    """Devuelve la imagen re-codificada sin metadatos o lanza `ValidationError` (400)."""
    formato, opciones = FORMATOS[mime]
    try:
        with Image.open(BytesIO(contenido)) as origen:
            origen.load()
            imagen = ImageOps.exif_transpose(origen)  # respeta la orientación antes de quitar el EXIF
            if min(imagen.size) < settings.FE_DE_VIDA_EVIDENCIA_LADO_MINIMO_PX:
                raise ValidationError(
                    f"La foto es muy pequeña: debe medir al menos {settings.FE_DE_VIDA_EVIDENCIA_LADO_MINIMO_PX} px por lado.",
                )
            if formato == 'JPEG' and imagen.mode != 'RGB':
                imagen = imagen.convert('RGB')
            salida = BytesIO()
            imagen.save(salida, format=formato, **opciones)  # sin `exif=`: no se conserva ningún metadato
            return salida.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValidationError("La foto no es una imagen válida.") from None
