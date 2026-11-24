"""
Preparación de la foto de carnet del postulante (G-2): validación y normalización antes de guardarla en el almacén.

  * firma REAL del archivo (JPEG o PNG; el `Content-Type` del cliente no cuenta) y tamaño máximo de 5 MB;
  * dimensiones: al menos 300 x 300 px (el carnet la imprime a unos pocos cm) y como máximo 12 000 px por lado
    (descarta bombas de descompresión); no puede ser una tira extrema (relación de aspecto <= 3:1);
  * se reencodifica (JPEG q88, lado largo <= 800 px) con la orientación EXIF aplicada: así se descartan los metadatos
    (GPS, cámara) y cualquier contenido embebido;
  * clave opaca con UUID y SIN la cédula (`postulacion/foto/<uuid>.jpg`).
"""
from io import BytesIO

from PIL import Image

from apps.postulacion.application.use_cases.ventana2 import PREFIJO_CLAVE_FOTO, FotoSubida
from core.domain.exceptions import ValidationError
from core.infrastructure.storage.imagenes import reducir_foto_perfil
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_FOTO, TIPOS_FOTO, clave_segura, validar_archivo

LADO_MINIMO_PX = 300
LADO_MAXIMO_PX = 12_000
RELACION_MAXIMA = 3


def preparar_foto_carnet(archivo) -> FotoSubida:
    contenido, _tipo, _ext = validar_archivo(archivo, TIPOS_FOTO, MAX_BYTES_FOTO)
    try:
        with Image.open(BytesIO(contenido)) as imagen:
            ancho, alto = imagen.size
    except Exception as exc:  # noqa: BLE001 - cualquier fallo de lectura es «no es una imagen válida»
        raise ValidationError("La imagen no se pudo leer; suba una foto JPG o PNG válida.") from exc
    if min(ancho, alto) < LADO_MINIMO_PX:
        raise ValidationError(
            f"La foto es muy pequeña ({ancho} x {alto} px): debe medir al menos {LADO_MINIMO_PX} x {LADO_MINIMO_PX} px."
        )
    if max(ancho, alto) > LADO_MAXIMO_PX or max(ancho, alto) / min(ancho, alto) > RELACION_MAXIMA:
        raise ValidationError("Las dimensiones de la foto no son válidas para un carnet; suba una foto de rostro normal.")
    normalizado, tipo, extension = reducir_foto_perfil(contenido)
    return FotoSubida(normalizado, tipo.mime, clave_segura(PREFIJO_CLAVE_FOTO, extension))
