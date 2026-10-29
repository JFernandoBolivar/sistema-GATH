"""
Casos de uso de la bandeja del propio usuario. Zero-IDOR: la cédula siempre la aporta la sesión
(la vista), y el repositorio filtra SIEMPRE por ella; una notificación ajena es indistinguible de una inexistente.
"""
from datetime import datetime

from apps.notificaciones.domain.entities.notificacion import Notificacion
from apps.notificaciones.domain.ports.repo_notificaciones import RepoNotificaciones
from apps.notificaciones.domain.ports.servicios import CacheConteo
from core.domain.exceptions import NotFoundError

LIMITE_MAXIMO = 100


def listar_notificaciones(
    repo: RepoNotificaciones, cedula: str, *, solo_no_leidas: bool = False, limite: int = 20, desplazamiento: int = 0,
) -> tuple[list[Notificacion], int, int, int]:
    """Devuelve (página, total, límite aplicado, desplazamiento aplicado)."""
    limite = max(1, min(limite, LIMITE_MAXIMO))
    desplazamiento = max(0, desplazamiento)
    pagina, total = repo.listar(cedula, solo_no_leidas, limite, desplazamiento)
    return pagina, total, limite, desplazamiento


def conteo_no_leidas(repo: RepoNotificaciones, cache: CacheConteo, cedula: str) -> int:
    """Contador barato para el polling de la campana: caché con invalidación al crear o leer."""
    en_cache = cache.obtener(cedula)
    if en_cache is not None:
        return en_cache
    total = repo.contar_no_leidas(cedula)
    cache.guardar(cedula, total)
    return total


def marcar_leida(repo: RepoNotificaciones, cache: CacheConteo, cedula: str, notificacion_id: str, ahora: datetime) -> None:
    if not repo.marcar_leida(cedula, notificacion_id, ahora):
        raise NotFoundError('La notificación no existe.')
    cache.invalidar(cedula)


def marcar_todas_leidas(repo: RepoNotificaciones, cache: CacheConteo, cedula: str, ahora: datetime) -> int:
    marcadas = repo.marcar_todas_leidas(cedula, ahora)
    if marcadas:
        cache.invalidar(cedula)
    return marcadas
