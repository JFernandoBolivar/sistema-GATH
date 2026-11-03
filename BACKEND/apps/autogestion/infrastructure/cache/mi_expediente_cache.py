"""Caché de la respuesta de «Mi expediente» (L-01)."""
import logging
from django.core.cache import cache

_logger = logging.getLogger(__name__)

TTL_MI_EXPEDIENTE = 300
_PREFIJO = 'autogestion:mi_expediente'


def clave_mi_expediente(cedula: str) -> str:
    return f'{_PREFIJO}:{cedula}'


def leer_mi_expediente(cedula: str):
    try:
        return cache.get(clave_mi_expediente(cedula))
    except Exception:  # noqa: BLE001 - la caché no debe tumbar el portal
        _logger.warning('cache.fallo', extra={'modulo': __name__}, exc_info=True)
        return None


def guardar_mi_expediente(cedula: str, valor) -> None:
    try:
        cache.set(clave_mi_expediente(cedula), valor, TTL_MI_EXPEDIENTE)
    except Exception:  # noqa: BLE001
        _logger.warning('cache.fallo', extra={'modulo': __name__}, exc_info=True)
        pass


def invalidar_mi_expediente(cedula: str | None) -> None:
    if not cedula:
        return
    try:
        cache.delete(clave_mi_expediente(str(cedula)))
    except Exception:  # noqa: BLE001
        _logger.warning('cache.fallo', extra={'modulo': __name__}, exc_info=True)
        pass
