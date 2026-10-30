"""
Límites de filas de los reportes descargables (G3 / revisión M5).

`REPORTES_MAX_FILAS` acota cualquier reporte y admite `0` (sin tope) para las
salidas que se consumen por pantalla. Un **PDF** nunca se genera sin tope: usa
`REPORTES_MAX_FILAS_PDF`, que `settings` garantiza positivo.
"""
from django.conf import settings


def limite_de_reporte(*, para_pdf: bool) -> int:
    """Tope de filas que debe aplicar el repositorio (0 = sin tope en JSON/Excel)."""
    if para_pdf:
        return int(settings.REPORTES_MAX_FILAS_PDF)
    return int(settings.REPORTES_MAX_FILAS)
