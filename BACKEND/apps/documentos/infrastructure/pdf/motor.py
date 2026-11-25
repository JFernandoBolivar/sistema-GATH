"""Motor de PDF de documentos: despacha por modo (formulario / pdf_overlay) e inspecciona PDF de fondo (F-1, F-2)."""
import logging

from apps.documentos.infrastructure.pdf.motor_formulario import renderizar_formulario
from apps.documentos.infrastructure.pdf.motor_overlay import renderizar_overlay
from core.infrastructure.pdf.rasterizar_pdf import inspeccionar_pdf, rasterizar_pagina_pdf

logger = logging.getLogger('gath.documentos')
MM_POR_PT = 25.4 / 72.0


def _config_institucional() -> dict | None:
    """Cintillo y logos de la configuración visual; si no se pueden leer se usan los assets por defecto."""
    try:
        from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
        return construir_config_pdf()
    except Exception:  # noqa: BLE001 - nunca se bloquea un documento por la imagen del cintillo
        logger.warning('No se pudo leer la configuración visual para el PDF; se usan los logos por defecto.', exc_info=True)
        return None


class MotorPdfDocumentos:
    def renderizar(self, contexto: dict, datos: dict) -> bytes:
        if contexto['modo'] == 'pdf_overlay':
            return renderizar_overlay(contexto, datos)
        if 'config_pdf' in contexto:
            config = contexto['config_pdf']
        elif contexto['definicion']['encabezado']['tipo'] == 'institucional':
            config = _config_institucional()
        else:
            config = None
        return renderizar_formulario(contexto, datos, config)

    def renderizar_pagina_fondo(self, contenido_pdf: bytes, numero: int) -> bytes:
        return rasterizar_pagina_pdf(contenido_pdf, numero)


def _rotacion_de(contenido: bytes, numero: int) -> int:
    """Rotación (0, 90, 180, 270) declarada por la página; 0 si no se puede leer.

    Los escaneos a menudo traen la página apaisada con `/Rotate` 90 o 270: Poppler la dibuja ya girada (vertical), pero
    `pdfinfo` informa la medida SIN girar. Hay que intercambiar ancho y alto o el fondo se estira.
    """
    try:
        from pdf2image import pdfinfo_from_bytes
        info = pdfinfo_from_bytes(contenido, first_page=numero, last_page=numero, timeout=20)
        return int(next((v for k, v in info.items() if str(k).strip().endswith('rot')), 0)) % 360
    except Exception:  # noqa: BLE001 - sin rotación legible se asume la medida informada
        return 0


class InspectorPdfDocumentos:
    def inspeccionar(self, contenido: bytes) -> list[dict]:
        paginas, _, _ = inspeccionar_pdf(contenido, 1)
        salida = []
        for n in range(1, paginas + 1):
            _, ancho_pt, alto_pt = inspeccionar_pdf(contenido, n)
            if _rotacion_de(contenido, n) in (90, 270):
                ancho_pt, alto_pt = alto_pt, ancho_pt
            salida.append({'numero': n, 'ancho_pt': round(ancho_pt, 2), 'alto_pt': round(alto_pt, 2),
                           'ancho_mm': round(ancho_pt * MM_POR_PT, 2), 'alto_mm': round(alto_pt * MM_POR_PT, 2)})
        return salida
