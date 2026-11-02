"""
Motivo/justificación de una acción de revisión que lo exige: mínimo 5 palabras y 20 caracteres, sin HTML.
Misma regla que el motivo de las solicitudes de actualización (autogestión), propia del módulo (B16). Puro.
"""
import re

from core.domain.exceptions import ValidationError

MOTIVO_MIN_PALABRAS = 5
MOTIVO_MIN_CARACTERES = 20
MOTIVO_MAX_CARACTERES = 500
_ETIQUETA_HTML = re.compile(r'<[^>]*>|[<>]')


def validar_motivo(motivo: str) -> str:
    """Devuelve el motivo normalizado (espacios colapsados) o lanza `ValidationError`."""
    motivo = ' '.join((motivo or '').split())
    if not motivo:
        raise ValidationError("El motivo es obligatorio.")
    if _ETIQUETA_HTML.search(motivo):
        raise ValidationError("El motivo no puede contener etiquetas HTML ni los símbolos < o >.")
    if len(motivo) < MOTIVO_MIN_CARACTERES or len(motivo.split()) < MOTIVO_MIN_PALABRAS:
        raise ValidationError(
            f"El motivo debe tener al menos {MOTIVO_MIN_PALABRAS} palabras y {MOTIVO_MIN_CARACTERES} caracteres."
        )
    if len(motivo) > MOTIVO_MAX_CARACTERES:
        raise ValidationError(f"El motivo no puede exceder {MOTIVO_MAX_CARACTERES} caracteres.")
    return motivo
