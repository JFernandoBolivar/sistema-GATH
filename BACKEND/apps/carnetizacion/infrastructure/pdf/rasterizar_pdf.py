"""Rasterizado de una página de un PDF para usarla como fondo del carnet (B-2, H-13, K-4).

ReportLab no dibuja PDF como imagen y B-8 prohíbe servirlos inline, así que la página
elegida se convierte a PNG con ``pdf2image`` (Poppler/``pdftoppm``). Un PDF lo sube un
usuario, así que antes de rasterizar se inspecciona con ``pdfinfo`` y se imponen límites
(K-4): número de páginas, tamaño de la página, resolución de salida y tiempo máximo. Un
PDF con una página de 5 m x 5 m o miles de páginas se rechaza sin llegar a dibujarse.
"""
import logging
import re
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
    "No se pudo leer la página del PDF. Verifique que el archivo no esté "
    "dañado ni protegido y vuelva a intentarlo."
)

_LADO_MAXIMO_PX = 2400
_DPI_MAXIMO = 200
# Límites para PDF subidos por usuarios (K-4).
MAX_PAGINAS_PDF = 50
LADO_MAXIMO_PAGINA_PT = 2384  # lado largo de un A2 (594 mm); un fondo de carnet no necesita más
TIEMPO_MAXIMO_S = 20

_TAMANO_PAGINA = re.compile(r'([\d.]+)\s*x\s*([\d.]+)\s*pts')


def _herramientas_disponibles():
    """(`convert_from_bytes`, `pdfinfo_from_bytes`) de pdf2image, o None si falta Poppler."""
    try:
        from pdf2image import convert_from_bytes, pdfinfo_from_bytes
    except Exception:  # noqa: BLE001 - dependencia opcional en tiempo de ejecución
        return None
    if not shutil.which('pdftoppm') or not shutil.which('pdfinfo'):
        return None
    return convert_from_bytes, pdfinfo_from_bytes


def inspeccionar_pdf(contenido: bytes, pagina: int = 1) -> tuple[int, float, float]:
    """(número de páginas, ancho_pt, alto_pt de `pagina`). Valida los límites de K-4."""
    herramientas = _herramientas_disponibles()
    if herramientas is None:
        raise ValidationError(MENSAJE_PDF_SIN_RASTERIZADOR)
    _, pdfinfo_from_bytes = herramientas
    try:
        # Primero el número de páginas, para que una página fuera de rango dé un mensaje claro.
        paginas = int(pdfinfo_from_bytes(contenido, timeout=TIEMPO_MAXIMO_S).get('Pages') or 0)
    except Exception as exc:  # noqa: BLE001 - pdfinfo lanza tipos distintos (incluido el timeout)
        raise ValidationError(MENSAJE_PDF_ILEGIBLE) from exc
    if paginas < 1:
        raise ValidationError(MENSAJE_PDF_ILEGIBLE)
    if paginas > MAX_PAGINAS_PDF:
        raise ValidationError(
            f"El PDF tiene {paginas} páginas; para usarlo de fondo se admiten hasta {MAX_PAGINAS_PDF}."
        )
    if not 1 <= pagina <= paginas:
        raise ValidationError(f"El PDF tiene {paginas} página(s); elija una entre 1 y {paginas}.", campo='pagina')
    try:
        info = pdfinfo_from_bytes(contenido, first_page=pagina, last_page=pagina, timeout=TIEMPO_MAXIMO_S)
    except Exception as exc:  # noqa: BLE001
        raise ValidationError(MENSAJE_PDF_ILEGIBLE) from exc

    tamano = next((v for k, v in info.items() if 'size' in k and 'File' not in k), '')
    medida = _TAMANO_PAGINA.search(str(tamano))
    if not medida:
        raise ValidationError(MENSAJE_PDF_ILEGIBLE)
    ancho_pt, alto_pt = float(medida.group(1)), float(medida.group(2))
    if max(ancho_pt, alto_pt) > LADO_MAXIMO_PAGINA_PT or min(ancho_pt, alto_pt) <= 0:
        raise ValidationError(
            "La página del PDF es demasiado grande para usarla de fondo (máximo un A2). "
            "Exporte la página en un tamaño menor."
        )
    return paginas, ancho_pt, alto_pt


def rasterizar_pagina_pdf(contenido: bytes, pagina: int = 1) -> bytes:
    """PNG (bytes) de la página `pagina` (1 = primera) del PDF, con un lado de 2400 px como máximo.

    Lanza ``ValidationError`` con un mensaje accionable si no hay rasterizador, si el archivo
    no es un PDF legible, si supera los límites o si la página no existe.
    """
    if not contenido:
        raise ValidationError(MENSAJE_PDF_ILEGIBLE)
    _, ancho_pt, alto_pt = inspeccionar_pdf(contenido, pagina)
    convert_from_bytes, _ = _herramientas_disponibles()

    # Resolución justa para no pasar de 2400 px en el lado largo (nunca más de 200 ppp).
    dpi = max(36, min(_DPI_MAXIMO, int(_LADO_MAXIMO_PX * 72 / max(ancho_pt, alto_pt))))
    try:
        paginas = convert_from_bytes(
            contenido,
            first_page=pagina,
            last_page=pagina,
            fmt='png',
            dpi=dpi,
            timeout=TIEMPO_MAXIMO_S,
        )
    except Exception as exc:  # noqa: BLE001 - pdf2image lanza tipos distintos según el fallo
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
    except Exception as exc:  # noqa: BLE001 - PIL puede fallar con páginas raras
        raise ValidationError(MENSAJE_PDF_ILEGIBLE) from exc
    finally:
        try:
            imagen.close()
        except Exception:  # noqa: BLE001 - cerrar no debe enmascarar el resultado
            logger.warning('No se pudo cerrar la imagen rasterizada del PDF.', exc_info=True)


def rasterizar_primera_pagina_pdf(contenido: bytes) -> bytes:
    """Compatibilidad: la primera página."""
    return rasterizar_pagina_pdf(contenido, 1)
