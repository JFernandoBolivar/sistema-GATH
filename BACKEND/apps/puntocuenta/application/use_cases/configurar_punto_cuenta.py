"""
Casos de uso para leer y actualizar la configuración de Punto de Cuenta.
"""
from typing import Any
from django.db import transaction

from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA
from core.infrastructure.providers import obtener_lector_configuracion
from apps.puntocuenta.domain.services.variables_plantilla import obtener_ayuda_variables
from apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model import (
    ConfiguracionPuntoCuentaModel,
    CUERPO_POR_DEFECTO,
    ENCABEZADO_POR_DEFECTO,
    FIRMAS_POR_DEFECTO,
    PROCESOS_POR_DEFECTO,
    TITULO_POR_DEFECTO,
)


def _generacion_activa() -> bool:
    try:
        lector = obtener_lector_configuracion()
        return bool(lector.obtener_booleano(CLAVE_GENERAR_PUNTOS_CUENTA)) if lector is not None else False
    except Exception:
        return False


def obtener_configuracion_activa() -> dict[str, Any]:
    """Obtiene la configuración más reciente o los valores por defecto."""
    generar = _generacion_activa()
    cfg = None
    try:
        cfg = ConfiguracionPuntoCuentaModel.objects.first()
    except Exception:
        cfg = None

    if cfg is None:
        return {
            'generar': generar,
            'procesos_habilitados': dict(PROCESOS_POR_DEFECTO),
            'titulo': TITULO_POR_DEFECTO,
            'encabezado': ENCABEZADO_POR_DEFECTO,
            'cuerpo': CUERPO_POR_DEFECTO,
            'firmas': list(FIRMAS_POR_DEFECTO),
            'mostrar_nivel': True,
            'plantillas_procesos': {},
            'variables_disponibles': obtener_ayuda_variables(),
            'version': 1,
            'actualizado_por_id': None,
        }

    # Asegurar que todos los procesos conocidos estén presentes
    procesos = dict(PROCESOS_POR_DEFECTO)
    procesos.update(cfg.procesos_habilitados or {})

    return {
        'id': str(cfg.pk),
        'generar': generar,
        'procesos_habilitados': procesos,
        'titulo': cfg.titulo or TITULO_POR_DEFECTO,
        'encabezado': cfg.encabezado if cfg.encabezado is not None else ENCABEZADO_POR_DEFECTO,
        'cuerpo': cfg.cuerpo if cfg.cuerpo is not None else CUERPO_POR_DEFECTO,
        'firmas': list(cfg.firmas) if cfg.firmas is not None else list(FIRMAS_POR_DEFECTO),
        'mostrar_nivel': bool(cfg.mostrar_nivel),
        'plantillas_procesos': dict(getattr(cfg, 'plantillas_procesos', None) or {}),
        'variables_disponibles': obtener_ayuda_variables(),
        'version': cfg.version,
        'actualizado_por_id': cfg.actualizado_por_id,
        'updated_at': cfg.updated_at.isoformat() if hasattr(cfg, 'updated_at') and cfg.updated_at else None,
    }


def guardar_configuracion(datos: dict[str, Any], usuario_id: int | None) -> dict[str, Any]:
    """
    Crea una nueva versión de la configuración de punto de cuenta
    y actualiza el parámetro general `puntocuenta.generar` si fue provisto.
    """
    with transaction.atomic():
        if 'generar' in datos:
            from apps.configuracion.application.use_cases.guardar_parametro import guardar_parametro
            from apps.configuracion.infrastructure.repositories.repo_parametros_orm import RepoParametrosORM
            guardar_parametro(
                repo=RepoParametrosORM(),
                clave=CLAVE_GENERAR_PUNTOS_CUENTA,
                valor_nuevo='true' if datos['generar'] else 'false',
                usuario_id=usuario_id,
            )

        cfg_actual = ConfiguracionPuntoCuentaModel.objects.first()
        nueva_version = (cfg_actual.version + 1) if cfg_actual else 1

        procesos = dict(PROCESOS_POR_DEFECTO)
        if 'procesos_habilitados' in datos and isinstance(datos['procesos_habilitados'], dict):
            procesos.update(datos['procesos_habilitados'])
        elif cfg_actual and cfg_actual.procesos_habilitados:
            procesos.update(cfg_actual.procesos_habilitados)

        plantillas = dict(
            datos.get('plantillas_procesos')
            if 'plantillas_procesos' in datos
            else (getattr(cfg_actual, 'plantillas_procesos', None) or {})
        )

        nuevo = ConfiguracionPuntoCuentaModel.objects.create(
            procesos_habilitados=procesos,
            titulo=str(datos.get('titulo') or (cfg_actual.titulo if cfg_actual else TITULO_POR_DEFECTO)).strip(),
            encabezado=str(datos.get('encabezado') if 'encabezado' in datos else (cfg_actual.encabezado if cfg_actual else ENCABEZADO_POR_DEFECTO)),
            cuerpo=str(datos.get('cuerpo') if 'cuerpo' in datos else (cfg_actual.cuerpo if cfg_actual else CUERPO_POR_DEFECTO)),
            firmas=list(datos.get('firmas') if 'firmas' in datos else (cfg_actual.firmas if cfg_actual else FIRMAS_POR_DEFECTO)),
            mostrar_nivel=bool(datos.get('mostrar_nivel', cfg_actual.mostrar_nivel if cfg_actual else True)),
            plantillas_procesos=plantillas,
            version=nueva_version,
            actualizado_por_id=usuario_id,
        )

        return obtener_configuracion_activa()
