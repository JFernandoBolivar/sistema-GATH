"""
Tipografía de los PDF: Arial (pedido del usuario, 2026-11-04).

En la imagen Docker Arial se instala con el paquete oficial
`ttf-mscorefonts-installer` (ver `django.dockerfile`), que la descarga de
Microsoft aceptando su licencia; no se copian archivos de fuentes al repo.
Si no se encuentra (p. ej. la descarga falló al construir), se usa Helvetica,
que tiene las mismas métricas, para no romper la generación de ningún PDF.

`FUENTE`, `FUENTE_NEGRITA`, `FUENTE_CURSIVA` son los nombres a usar en
`ParagraphStyle(fontName=...)`, `canvas.setFont(...)` y estilos de tabla.
`<b>` e `<i>` dentro de un Paragraph también salen en Arial gracias a
`registerFontFamily`.
"""
import logging
import os

from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logger = logging.getLogger('gath.pdf')

# (normal, negrita, cursiva, negrita cursiva) por carpeta candidata.
_VARIANTES = (
    ('Arial.ttf', 'Arial_Bold.ttf', 'Arial_Italic.ttf', 'Arial_Bold_Italic.ttf'),  # msttcorefonts (Debian)
    ('arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'arialbi.ttf'),  # Windows
)
_CARPETAS = (
    os.environ.get('PDF_FUENTES_DIR', ''),
    '/usr/share/fonts/truetype/msttcorefonts',
    '/usr/share/fonts/truetype/msttcorefonts/',
    r'C:\Windows\Fonts',
)


def _buscar_arial() -> tuple[str, str, str, str] | None:
    for carpeta in filter(None, _CARPETAS):
        for nombres in _VARIANTES:
            rutas = tuple(os.path.join(carpeta, n) for n in nombres)
            if all(os.path.isfile(r) for r in rutas):
                return rutas
    return None


def _registrar() -> tuple[str, str, str]:
    rutas = _buscar_arial()
    if rutas is None:
        logger.warning('Arial no está instalada; los PDF usarán Helvetica (mismas métricas).')
        return 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'
    nombres = ('Arial', 'Arial-Bold', 'Arial-Italic', 'Arial-BoldItalic')
    for nombre, ruta in zip(nombres, rutas):
        if nombre not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(nombre, ruta))
    pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial-Italic', boldItalic='Arial-BoldItalic')
    for negrita, cursiva, nombre in ((0, 0, 'Arial'), (1, 0, 'Arial-Bold'), (0, 1, 'Arial-Italic'), (1, 1, 'Arial-BoldItalic')):
        addMapping('Arial', negrita, cursiva, nombre)
    return 'Arial', 'Arial-Bold', 'Arial-Italic'


FUENTE, FUENTE_NEGRITA, FUENTE_CURSIVA = _registrar()
