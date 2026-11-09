"""
Límites de filas de los documentos descargables y de los listados transversales.

Vive en `core/` (regla B16) porque lo usan varios módulos: los reportes y el
historial de movimientos. `REPORTES_MAX_FILAS` acota las salidas que se
consumen por pantalla o en Excel y admite `0` (sin tope); un **PDF** nunca se
genera sin tope porque no hay paginación posible en el documento.
"""
from django.conf import settings


def limite_de_reporte(*, para_pdf: bool) -> int:
    """Tope de filas que debe aplicar el repositorio (0 = sin tope)."""
    if para_pdf:
        return int(settings.REPORTES_MAX_FILAS_PDF)
    return int(settings.REPORTES_MAX_FILAS)
