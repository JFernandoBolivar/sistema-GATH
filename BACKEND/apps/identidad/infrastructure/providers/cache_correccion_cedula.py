"""
Limpieza de cachés tras corregir una cédula. Solo se borran las claves conocidas por cédula
(nunca `cache.clear()`): permisos efectivos, bloqueos de login, «Mi expediente» y el contador de
notificaciones no leídas.
"""
import logging

from django.core.cache import cache

from apps.identidad.infrastructure.repositories.repo_bloqueos_cache_db import RepoBloqueosCacheDB
from core.domain.notificaciones import MODULOS_NOTIFICACION

logger = logging.getLogger('security_backend')

_VERSIONES_MAX = 500


def invalidar_caches_cedula(
    cedula_vieja: str, cedula_nueva: str, correo: str | None, version: int | None,
) -> None:
    claves: list[str] = []
    topes = range(1, min(int(version or 1), _VERSIONES_MAX) + 2)
    for cedula in (cedula_vieja, cedula_nueva):
        claves += [f'iam:permisos:{cedula}:{v}' for v in topes]
        claves.append(f'autogestion:mi_expediente:{cedula}')
        claves += [f'notif:no_leidas:{cedula}:{m or "todos"}' for m in (*MODULOS_NOTIFICACION, None)]
    try:
        cache.delete_many(claves)
        bloqueos = RepoBloqueosCacheDB()
        for identificador in {cedula_vieja, cedula_nueva, correo, (correo or '').lower()} - {None, ''}:
            bloqueos.resetear(str(identificador))
    except Exception:  # noqa: BLE001 - la caché nunca debe tumbar la corrección ya confirmada
        logger.warning('corregir cédula: no se pudo limpiar la caché', exc_info=True)
