"""Rasterizado de la primera página de un PDF para usarla como fondo del carnet (B-2).

La Biblioteca de Medios puede conservar PDF históricos. ReportLab no dibuja PDF
como imagen y B-8 prohíbe servirlos inline, así que aquí se convierten a PNG con
``pdf2image`` (ya en ``requirements.txt``). ``pdf2image`` necesita el binario
``pdftoppm`` de Poppler; si no está instalado se rechaza el PDF con un mensaje
claro en vez de agregar una dependencia nativa nueva.
"""
import logging
import shutil
from io import BytesIO

from PIL import Image

from core.domain.exceptions import ValidationError

logger = logging.getLogger('gath.carnetizacion')

MENSAJE_PDF_SIN_RASTERIZADOR = (
    "No se puede usar un PDF como fondo: el servidor no tiene instalado el "
    "rasterizador de PDF (Poppler/pdftoppm). Convierta la página a PNG o JPEG y "
    "súbala a la Biblioteca de Medios."
)
MENSAJE_PDF_ILEGIBLE = (
    "No se pudo leer la primera página del PDF. Verifique que el archivo no esté "
    "dañado ni protegido y vuelva a intentarlo."
)

_LADO_MAXIMO_PX = 2400
_DPI_RASTERIZADO = 200


def _convertidor_disponible():
    """``convert_from_bytes`` de pdf2image o None si falta la librería o Poppler."""
    try:
        from pdf2image import convert_from_bytes
    except Exception:  # noqa: BLE001 - dependencia opcional en tiempo de ejecución
        return None
    if not shutil.which('pdftoppm'):
        return None
    return convert_from_bytes


def rasterizar_primera_pagina_pdf(contenido: bytes) -> bytes:
    """PNG (bytes) de la primera página del PDF.

    Lanza ``ValidationError`` con un mensaje accionable si no hay rasterizador,
    si el archivo no es un PDF o si la página no se puede convertir.
    """
    if not contenido:
        raise ValidationError(MENSAJE_PDF_ILEGIBLE)

    convert_from_bytes = _convertidor_disponible()
    if convert_from_bytes is None:
        raise ValidationError(MENSAJE_PDF_SIN_RASTERIZADOR)

    try:
        paginas = convert_from_bytes(
            contenido,
            first_page=1,
            last_page=1,
            fmt='png',
            dpi=_DPI_RASTERIZADO,
        )
    except Exception as exc:  # pdf2image lanza tipos distintos según el fallo
        raise ValidationError(MENSAJE_PDF_ILEGIBLE) from exc

    if not paginas or paginas[0] is None:
        raise ValidationError(MENSAJE_PDF_ILEGIBLE)

    imagen = paginas[0]
    try:
        imagen.load()
        if max(imagen.size) > _LADO_MAXIMO_PX:
            imagen.thumbnail((_LADO_MAXIMO_PX, _LADO_MAXIMO_PX), Image.LANCZOS)
        salida = BytesIO()
        render = imagen.convert('RGB') if imagen.mode not in ('RGB', 'RGBA') else imagen
        try:
            render.save(salida, format='PNG', optimize=True)
        finally:
            if render is not imagen:
                render.close()
        return salida.getvalue()
    except Exception as exc:  # PIL puede fallar con páginas raras
        raise ValidationError(MENSAJE_PDF_ILEGIBLE) from exc
    finally:
        try:
            imagen.close()
        except Exception:  # cerrar no debe enmascarar el resultado
            logger.warning('No se pudo cerrar la imagen rasterizada del PDF.', exc_info=True)
