"""Mapeo entre los tipos persistidos del historial y los procesos documentales."""

import re
from unicodedata import normalize

PROCESO_INGRESO = 'movimiento:ingreso'
PROCESO_TRASLADO = 'movimiento:traslado'
PROCESO_EGRESO = 'movimiento:egreso'
PROCESO_CAMBIO_ESTATUS = 'movimiento:cambio_de_estatus'

_PROCESOS = {
    'INGRESO': PROCESO_INGRESO,
    'TRASLADO': PROCESO_TRASLADO,
    'EGRESO': PROCESO_EGRESO,
    'CAMBIO DE ESTATUS': PROCESO_CAMBIO_ESTATUS,
}


def proceso_de_movimiento(tipo_movimiento: str | None) -> str | None:
    """Devuelve `movimiento:<tipo>`; los tipos históricos son los cuatro del modelo.

    Se normalizan espacios, mayúsculas y acentos para no depender de cómo llegue
    el dato del evento. Un tipo desconocido no genera documentos (no-op).
    """
    if not tipo_movimiento:
        return None
    texto = normalize('NFD', str(tipo_movimiento)).encode('ascii', 'ignore').decode('ascii')
    clave = re.sub(r'[\s_]+', ' ', texto.strip().upper())
    return _PROCESOS.get(clave)
