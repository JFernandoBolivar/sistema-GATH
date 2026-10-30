"""
Caché del contador de no leídas sobre la caché por defecto de Django (Redis en el despliegue).

Degrada en silencio: si la caché no responde, el contador se calcula en la BD (nunca se rompe la
campana por una caída de Redis). La invalidación espera al commit para no cachear un valor viejo.
"""
import logging

from django.core.cache import cache
from django.db import transaction

from core.domain.notificaciones import MODULOS_NOTIFICACION

logger = logging.getLogger('gath.notificaciones')

TTL_SEGUNDOS = 120


def _clave(cedula: str, modulo: str) -> str:
    return f'notif:no_leidas:{cedula}:{modulo}'


class CacheConteoDjango:
    def obtener(self, cedula: str, modulo: str) -> int | None:
        try:
            valor = cache.get(_clave(cedula, modulo))
        except Exception as exc:  # noqa: BLE001
            logger.warning('caché de notificaciones no disponible (get): %s', exc)
            return None
        return valor if isinstance(valor, int) else None

    def guardar(self, cedula: str, modulo: str, total: int) -> None:
        try:
            cache.set(_clave(cedula, modulo), total, TTL_SEGUNDOS)
        except Exception as exc:  # noqa: BLE001
            logger.warning('caché de notificaciones no disponible (set): %s', exc)

    def invalidar(self, cedula: str) -> None:
        def _borrar():
            try:
                cache.delete_many([_clave(cedula, m) for m in MODULOS_NOTIFICACION])
            except Exception as exc:  # noqa: BLE001
                logger.warning('caché de notificaciones no disponible (delete): %s', exc)

        transaction.on_commit(_borrar)
