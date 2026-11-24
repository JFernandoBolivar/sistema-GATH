"""Compatibilidad: el rasterizado de PDF vive ahora en el kernel (F-2), compartido con `apps.documentos`.

Este módulo conserva los nombres históricos para el carnet y sus pruebas.
"""
import shutil  # noqa: F401 - las pruebas simulan la ausencia de Poppler con `rasterizar_pdf.shutil`

from core.infrastructure.pdf.rasterizar_pdf import (  # noqa: F401
    LADO_MAXIMO_PAGINA_PT,
    MAX_PAGINAS_PDF,
    MENSAJE_PDF_ILEGIBLE,
    MENSAJE_PDF_SIN_RASTERIZADOR,
    TIEMPO_MAXIMO_S,
    inspeccionar_pdf,
    rasterizar_pagina_pdf,
    rasterizar_primera_pagina_pdf,
)
