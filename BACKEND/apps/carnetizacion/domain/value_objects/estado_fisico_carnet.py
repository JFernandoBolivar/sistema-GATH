"""Ciclo físico de un carnet emitido (B-5): EMITIDO → IMPRESO → ENTREGADO, y ANULADO con motivo.

`CarnetEmitido.activo` (tabla heredada) sigue siendo la fuente de verdad de la vigencia: un
carnet inactivo es ANULADO aunque su ciclo diga otra cosa. Puro: sin Django (regla B1).
"""
from core.domain.exceptions import ConflictError

EMITIDO = 'EMITIDO'
IMPRESO = 'IMPRESO'
ENTREGADO = 'ENTREGADO'
ANULADO = 'ANULADO'

ESTADOS = (EMITIDO, IMPRESO, ENTREGADO, ANULADO)

# Destino → estados desde los que se puede llegar.
_ORIGENES = {
    IMPRESO: (EMITIDO,),
    ENTREGADO: (IMPRESO,),
    ANULADO: (EMITIDO, IMPRESO, ENTREGADO),
}

_MENSAJES = {
    IMPRESO: 'Solo se marca como impreso un carnet recién emitido.',
    ENTREGADO: 'Solo se entrega un carnet ya impreso. Márquelo como impreso primero.',
    ANULADO: 'El carnet ya está anulado.',
}


def estado_efectivo(activo: bool, estado_ciclo: str | None) -> str:
    if not activo:
        return ANULADO
    return estado_ciclo if estado_ciclo in (IMPRESO, ENTREGADO) else EMITIDO


def exigir_transicion(actual: str, destino: str) -> None:
    if actual not in _ORIGENES.get(destino, ()):
        raise ConflictError(_MENSAJES.get(destino, 'Cambio de estado no permitido.'))
