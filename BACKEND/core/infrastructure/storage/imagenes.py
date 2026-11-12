"""Normalización de fotos de perfil antes de guardarlas en el almacén.

Una foto subida desde el teléfono llega a 4K y 2 MB; el sistema la muestra en
recuadros de unos pocos cm. Se guarda una versión con lado largo <= 800 px.
"""
from io import BytesIO

from PIL import Image, ImageOps

from core.domain.exceptions import ValidationError
from core.infrastructure.storage.validacion_archivo import JPEG, PNG, TipoArchivo

LADO_MAXIMO_PERFIL_PX = 800
CALIDAD_JPEG_PERFIL = 88


def reducir_foto_perfil(
    contenido: bytes, lado_max: int = LADO_MAXIMO_PERFIL_PX,
) -> tuple[bytes, TipoArchivo, str]:
    """Devuelve (bytes, tipo, extension): JPEG q88 de lado largo <= lado_max, o PNG si hay alfa.

    Aplica la orientación EXIF antes de reducir (la foto queda derecha).
    """
    try:
        with Image.open(BytesIO(contenido)) as img:
            img.load()
            img = ImageOps.exif_transpose(img)
            tiene_alfa = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
            if max(img.size) > lado_max:
                img.thumbnail((lado_max, lado_max), Image.LANCZOS)
            salida = BytesIO()
            if tiene_alfa:
                img.convert('RGBA').save(salida, format='PNG', optimize=True)
                return salida.getvalue(), PNG, '.png'
            img.convert('RGB').save(salida, format='JPEG', quality=CALIDAD_JPEG_PERFIL)
            return salida.getvalue(), JPEG, '.jpg'
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError("La imagen no se pudo leer; suba una foto JPG, PNG o WebP válida.") from exc
