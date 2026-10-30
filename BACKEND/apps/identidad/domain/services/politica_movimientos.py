"""Qué movimiento de cargo es un egreso real (decisión F, D8). Puro."""

# Categorías del catálogo `Tipo_movimiento` (RAC_categoria_movimiento) que sacan al trabajador de la nómina
# sin pase a pasivo: egreso (renuncia, destitución, fin de contrato...) y fallecimiento.
CATEGORIAS_EGRESO = frozenset({'EGRESO', 'FALLECIMIENTO'})


def es_movimiento_de_egreso(tipo_movimiento: str | None, categoria_motivo: str | None) -> bool:
    """Un traslado, un préstamo, un cambio de estatus o un ingreso nunca son egreso."""
    if (tipo_movimiento or '').upper() == 'EGRESO':
        return True
    return (categoria_motivo or '').strip().upper() in CATEGORIAS_EGRESO


def es_movimiento_de_ingreso(tipo_movimiento: str | None) -> bool:
    return (tipo_movimiento or '').upper() == 'INGRESO'
