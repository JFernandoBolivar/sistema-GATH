"""
Motivo de la reemisión del carnet (OC 2026-11-11, T2).

Regla de negocio pura: si la persona ya tiene un carnet vigente hay que indicar
por qué se reemite; «OTRO» exige un detalle de al menos 10 caracteres. El motivo
se guarda en `CarnetEmitido.motivo` (catálogo `MotivosEmision`) y el valor exacto
de este enumerado, junto con el detalle, queda en la bitácora de auditoría.
"""
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

MOTIVO_PERDIDA_ROBO = 'PERDIDA_ROBO'
MOTIVO_DETERIORO = 'DETERIORO'
MOTIVO_CAMBIO_DATOS = 'CAMBIO_DATOS'
MOTIVO_CAMBIO_CARGO = 'CAMBIO_CARGO'
MOTIVO_OTRO = 'OTRO'

MOTIVOS_REEMISION = (
    MOTIVO_PERDIDA_ROBO,
    MOTIVO_DETERIORO,
    MOTIVO_CAMBIO_DATOS,
    MOTIVO_CAMBIO_CARGO,
    MOTIVO_OTRO,
)

DETALLE_MINIMO = 10

# Nombre del catálogo `MotivosEmision` que corresponde a cada motivo.
NOMBRE_CATALOGO_POR_MOTIVO = {
    MOTIVO_PERDIDA_ROBO: 'PÉRDIDA',
    MOTIVO_DETERIORO: 'DAÑO',
    MOTIVO_CAMBIO_DATOS: 'ACTUALIZACIÓN',
    MOTIVO_CAMBIO_CARGO: 'ACTUALIZACIÓN',
}


@dataclass(frozen=True)
class MotivoReemision:
    """Motivo validado; `detalle` solo viene con «OTRO»."""

    motivo: str
    detalle: str = ''


def normalizar_reemision(
    motivo: str | None, detalle: str | None = None,
) -> MotivoReemision | None:
    """Valida el motivo de reemisión o devuelve None si no se indicó."""
    valor = (motivo or '').strip().upper()
    if not valor:
        return None
    if valor not in MOTIVOS_REEMISION:
        raise ValidationError(
            'El motivo de la reemisión no es válido.', campo='motivo_reemision',
        )
    texto = (detalle or '').strip()
    if valor == MOTIVO_OTRO and len(texto) < DETALLE_MINIMO:
        raise ValidationError(
            f'Indique el detalle de la reemisión (mínimo {DETALLE_MINIMO} caracteres).',
            campo='detalle',
        )
    if valor != MOTIVO_OTRO:
        texto = ''
    return MotivoReemision(motivo=valor, detalle=texto)
