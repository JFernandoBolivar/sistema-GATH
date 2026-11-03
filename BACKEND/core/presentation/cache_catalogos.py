"""
Caché de catálogos de solo lectura (Fase 2 de rendimiento).

Los catálogos del expediente se piden en cada apertura de formulario y no
cambian con la frecuencia de los datos de negocio. Se guardan en la caché
compartida (Redis en Docker) durante 10 minutos, con `ETag` y
`Cache-Control: private, max-age=300` para que el navegador y Next puedan
reutilizarlos.

La versión global (`catalogos:version`) permite invalidar todos los catálogos
de golpe cuando se crea/edita/elimina cualquiera de sus tablas: las claves
viejas dejan de consultarse y expiran solas por TTL, sin `delete_pattern`
(que no está disponible en el backend de caché nativo de Django).
"""
import hashlib
import json
import logging

from django.core.cache import cache
from django.http import HttpResponseNotModified

from core.presentation.envelope import ok

logger = logging.getLogger('gath.core')

TTL_CATALOGOS = 600
CACHE_CONTROL = 'private, max-age=300'
VERSION_KEY = 'catalogos:version'


def _version() -> int:
    version = cache.get(VERSION_KEY)
    if version is None:
        cache.set(VERSION_KEY, 1, None)
        return 1
    return int(version)


def invalidar_catalogos() -> None:
    """
    Marca toda la caché de catálogos como obsoleta (barato y atómico).

    Nunca propaga errores: una escritura de catálogo no debe fallar porque
    Redis no esté disponible; en el peor caso se sirve la versión anterior
    hasta que expire el TTL.
    """
    try:
        cache.incr(VERSION_KEY)
    except ValueError:
        try:
            cache.set(VERSION_KEY, 1, None)
        except Exception:  # noqa: BLE001
            logger.warning('No fue posible reiniciar la versión de catálogos.', exc_info=True)
    except Exception:  # noqa: BLE001
        logger.warning('No fue posible invalidar la caché de catálogos.', exc_info=True)


def _etag(data) -> str:
    crudo = json.dumps(data, ensure_ascii=False, sort_keys=True, default=str)
    return '"%s"' % hashlib.sha256(crudo.encode('utf-8')).hexdigest()[:32]


def ok_catalogo(request, nombre: str, generar, *, ttl: int = TTL_CATALOGOS):
    """
    Devuelve el sobre C-1 de un catálogo, reutilizando la caché si existe.

    Si la caché no responde, el catálogo se genera desde la base de datos: un
    fallo de Redis no debe tumbar una pantalla de solo lectura.
    """
    data = None
    clave = None
    try:
        clave = f'catalogo:{_version()}:{nombre}'
        data = cache.get(clave)
    except Exception:  # noqa: BLE001 - la caché es una optimización, no un requisito
        logger.warning('Caché de catálogos no disponible; se consulta la base.', exc_info=True)

    if data is None:
        data = generar()
        if clave is not None:
            try:
                cache.set(clave, data, ttl)
            except Exception:  # noqa: BLE001
                logger.warning('No fue posible guardar el catálogo en caché.', exc_info=True)

    etag = _etag(data)
    if request.META.get('HTTP_IF_NONE_MATCH') == etag:
        return HttpResponseNotModified(
            headers={'Cache-Control': CACHE_CONTROL, 'ETag': etag}
        )

    respuesta = ok(data)
    respuesta['Cache-Control'] = CACHE_CONTROL
    respuesta['ETag'] = etag
    return respuesta
