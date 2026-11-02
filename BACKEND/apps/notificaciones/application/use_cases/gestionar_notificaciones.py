"""
Casos de uso de la bandeja del propio usuario. Zero-IDOR: la cédula siempre la aporta la sesión
(la vista), y el repositorio filtra SIEMPRE por ella; una notificación ajena es indistinguible de una inexistente.
"""
from datetime import date, datetime

from apps.notificaciones.domain.entities.notificacion import Notificacion
from apps.notificaciones.domain.ports.repo_notificaciones import FiltroNotificaciones, RepoNotificaciones
from apps.notificaciones.domain.ports.servicios import CacheConteo
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.notificaciones import MODULOS_NOTIFICACION

LIMITE_PREDETERMINADO = 10  # tamaño de página si el cliente no pide otro
LIMITE_MAXIMO = 50  # techo de seguridad del servidor
LONGITUD_MAXIMA_BUSQUEDA = 100


def validar_modulo(modulo: str) -> str:
    if modulo not in MODULOS_NOTIFICACION:
        raise ValidationError('Indique un módulo válido: ' + ', '.join(MODULOS_NOTIFICACION) + '.')
    return modulo


def listar_notificaciones(
    repo: RepoNotificaciones, cedula: str, modulo: str, *, solo_no_leidas: bool = False, limite: int = LIMITE_PREDETERMINADO, desplazamiento: int = 0,
    q: str = '', tipo: str = '', leida: bool | None = None, desde: date | None = None, hasta: date | None = None,
) -> tuple[list[Notificacion], int, int, int]:
    """Devuelve (página, total, límite aplicado, desplazamiento aplicado). El límite se acota a LIMITE_MAXIMO."""
    if desde and hasta and desde > hasta:
        raise ValidationError('La fecha "desde" no puede ser posterior a "hasta".')
    if solo_no_leidas:
        leida = False
    filtro = FiltroNotificaciones(
        modulo=validar_modulo(modulo), q=(q or '').strip()[:LONGITUD_MAXIMA_BUSQUEDA], tipo=(tipo or '').strip(), leida=leida, desde=desde, hasta=hasta,
    )
    limite = max(1, min(limite, LIMITE_MAXIMO))
    desplazamiento = max(0, desplazamiento)
    pagina, total = repo.listar(cedula, filtro, limite, desplazamiento)
    return pagina, total, limite, desplazamiento


def conteo_no_leidas(repo: RepoNotificaciones, cache: CacheConteo, cedula: str, modulo: str) -> int:
    """Contador barato para el polling de la campana: caché con invalidación al crear o leer."""
    validar_modulo(modulo)
    en_cache = cache.obtener(cedula, modulo)
    if en_cache is not None:
        return en_cache
    total = repo.contar_no_leidas(cedula, modulo)
    cache.guardar(cedula, modulo, total)
    return total


def marcar_leida(repo: RepoNotificaciones, cache: CacheConteo, cedula: str, notificacion_id: str, ahora: datetime) -> None:
    if not repo.marcar_leida(cedula, notificacion_id, ahora):
        raise NotFoundError('La notificación no existe.')
    cache.invalidar(cedula)


def marcar_todas_leidas(repo: RepoNotificaciones, cache: CacheConteo, cedula: str, modulo: str, ahora: datetime) -> int:
    marcadas = repo.marcar_todas_leidas(cedula, validar_modulo(modulo), ahora)
    if marcadas:
        cache.invalidar(cedula)
    return marcadas
