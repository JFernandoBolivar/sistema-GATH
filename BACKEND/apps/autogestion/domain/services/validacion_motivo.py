"""
Motivo único de la solicitud de actualización (decisión G, B16): mínimo 5 palabras y 20 caracteres.
Puro: la misma regla la espera el formulario del trabajador (Zod) y el servidor.
"""
from core.domain.exceptions import ValidationError

MOTIVO_MIN_PALABRAS = 5
MOTIVO_MIN_CARACTERES = 20
MOTIVO_MAX_CARACTERES = 500


def validar_motivo_solicitud(motivo: str) -> str:
    motivo = ' '.join((motivo or '').split())
    if not motivo:
        raise ValidationError("El motivo es obligatorio.")
    if len(motivo) < MOTIVO_MIN_CARACTERES or len(motivo.split()) < MOTIVO_MIN_PALABRAS:
        raise ValidationError(
            f"El motivo debe tener al menos {MOTIVO_MIN_PALABRAS} palabras y {MOTIVO_MIN_CARACTERES} caracteres."
        )
    if len(motivo) > MOTIVO_MAX_CARACTERES:
        raise ValidationError(f"El motivo no puede exceder {MOTIVO_MAX_CARACTERES} caracteres.")
    return motivo
