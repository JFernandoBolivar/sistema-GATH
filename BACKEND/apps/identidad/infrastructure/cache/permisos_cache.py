"""Caché de los permisos efectivos resueltos por cuenta (A-02).

La clave incluye `permisos_version`: cualquier cambio de rol, de la matriz del
rol o de los overrides individuales incrementa esa versión y deja la entrada
anterior inalcanzable, de modo que la siguiente petición ve el cambio sin
esperar al TTL. No se cachea nada por rol: la política efectiva es por cuenta
(rol + overrides) y el resultado conserva el orden y el sobre de la respuesta.
"""
import logging
from django.core.cache import cache

from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.services.evaluador_permisos import evaluar_permiso
from apps.identidad.infrastructure.models.usuario_permiso_model import UsuarioPermisoModel

_logger = logging.getLogger(__name__)

TTL_PERMISOS = 300
TTL_CATALOGO = 3600
CLAVE_CATALOGO = 'iam:catalogo:codigos'


def clave_permisos(cedula: str, version: int) -> str:
    """Clave estable por cuenta y versión de permisos."""
    return f'iam:permisos:{cedula}:{version}'


def _obtener(clave: str):
    """Lectura tolerante a fallos de Redis: sin caché se resuelve en vivo."""
    try:
        return cache.get(clave)
    except Exception:  # noqa: BLE001 - la caché nunca debe tumbar la sesión
        _logger.warning('cache.fallo', extra={'modulo': __name__}, exc_info=True)
        return None


def _guardar(clave: str, valor, ttl: int) -> None:
    try:
        cache.set(clave, valor, ttl)
    except Exception:  # noqa: BLE001
        _logger.warning('cache.fallo', extra={'modulo': __name__}, exc_info=True)
        pass


def _catalogo(repo) -> list[str]:
    codigos = _obtener(CLAVE_CATALOGO)
    if codigos is None:
        codigos = [permiso.codigo.valor for permiso in repo.listar()]
        _guardar(CLAVE_CATALOGO, codigos, TTL_CATALOGO)
    return codigos


def resolver_permisos(
    repo, cedula: str, rol_id: int | None, version: int
) -> frozenset[str]:
    """Códigos efectivos de la cuenta, con caché por versión.

    En frío son 3 consultas (códigos del rol, override individual y catálogo;
    este último queda cacheado una hora). En caliente no consulta la BD.
    """
    clave = clave_permisos(cedula, version)
    guardado = _obtener(clave)
    if guardado is not None:
        return frozenset(guardado)

    allow = repo.codigos_del_rol(rol_id) if rol_id is not None else frozenset()
    override = (
        UsuarioPermisoModel.objects.filter(cedula=cedula)
        .values_list('permisos_custom', flat=True)
        .first()
    )
    custom = PoliticaAcceso.desde_dict(override) if override else PoliticaAcceso()
    politica = PoliticaAcceso(allow=allow | custom.allow, deny=custom.deny)

    codigos = frozenset(
        codigo for codigo in _catalogo(repo) if evaluar_permiso(politica, codigo)
    )
    _guardar(clave, sorted(codigos), TTL_PERMISOS)
    return codigos
