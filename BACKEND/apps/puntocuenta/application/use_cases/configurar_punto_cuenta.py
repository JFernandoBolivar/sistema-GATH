"""Casos de uso de la configuración operativa del Punto de Cuenta.

El ORM y las transacciones viven en `infrastructure` (A2-02). Los textos y
firmas se administran exclusivamente en el diseñador de documentos.
"""
import logging
from typing import Any

from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA
from core.infrastructure.providers import obtener_lector_configuracion
from apps.puntocuenta.domain.ports.repo_punto_cuenta_config import RepoConfiguracionPuntoCuenta
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import PROCESOS_POR_DEFECTO

logger = logging.getLogger('gath.puntocuenta')


def _generacion_activa() -> bool:
    try:
        lector = obtener_lector_configuracion()
        return bool(lector.obtener_booleano(CLAVE_GENERAR_PUNTOS_CUENTA)) if lector is not None else False
    except Exception:  # noqa: BLE001 - sin parámetro, la generación queda apagada
        logger.warning('no se pudo leer %s; se asume apagado', CLAVE_GENERAR_PUNTOS_CUENTA, exc_info=True)
        return False


def obtener_configuracion_activa(repo: RepoConfiguracionPuntoCuenta) -> dict[str, Any]:
    """Obtiene la configuración operativa más reciente o sus valores por defecto."""
    cfg = repo.actual()
    procesos = dict(PROCESOS_POR_DEFECTO)
    if cfg is not None:
        procesos.update(cfg.procesos_habilitados or {})
        return {
            'id': cfg.id,
            'generar': _generacion_activa(),
            'procesos_habilitados': procesos,
            'version': cfg.version,
            'actualizado_por_id': cfg.actualizado_por_id,
            'updated_at': cfg.actualizada_en.isoformat() if cfg.actualizada_en else None,
        }
    return {
        'id': None,
        'generar': _generacion_activa(),
        'procesos_habilitados': procesos,
        'version': 1,
        'actualizado_por_id': None,
        'updated_at': None,
    }


def guardar_configuracion(
    datos: dict[str, Any], usuario_id: int | None, repo: RepoConfiguracionPuntoCuenta,
) -> dict[str, Any]:
    """Audita una nueva versión de procesos habilitados y del interruptor general."""
    if 'generar' in datos:
        repo.guardar_generar(bool(datos['generar']), usuario_id)

    cfg_actual = repo.actual()
    procesos = dict(PROCESOS_POR_DEFECTO)
    if 'procesos_habilitados' in datos and isinstance(datos['procesos_habilitados'], dict):
        procesos.update(datos['procesos_habilitados'])
    elif cfg_actual is not None:
        procesos.update(cfg_actual.procesos_habilitados or {})

    repo.crear_version({
        'procesos_habilitados': procesos,
        'version': (cfg_actual.version + 1) if cfg_actual is not None else 1,
        'actualizado_por_id': usuario_id,
    })
    return obtener_configuracion_activa(repo)
