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

PRESENTADO_A_DEFECTO = "Director(a) General de la Comisión Nacional de Telecomunicaciones"
CARGO_PRESENTADO_A_DEFECTO = "Director(a) General"
PRESENTADO_POR_DEFECTO = "Director(a) General de Gestión Humana"
CARGO_PRESENTADO_POR_DEFECTO = "Director(a) General de Gestión Humana"
UNIDAD_DEFECTO = "Dirección General de Gestión Humana"
ASUNTO_DEFECTO = "Notificación y solicitud de aprobación para movimiento de personal de {nombre} (C.I. {cedula})."
EXPOSICION_DEFECTO = (
    "Por medio del presente punto de cuenta, se somete a su consideración el movimiento de personal del funcionario "
    "{nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}.\n\n"
    "Dicho movimiento corresponde a {motivo}, trasladándose desde {origen} hacia {destino}, con fecha {fecha}."
)
PROPUESTA_DEFECTO = (
    "En atención a lo expuesto, se propone muy respetuosamente a la Máxima Autoridad autorizar el traslado y "
    "asignación del funcionario {nombre} a la unidad {destino} en el cargo de {cargo_destino}."
)
BASE_LEGAL_DEFECTO = (
    "De conformidad con lo dispuesto en el Estatuto de la Función Pública, el Reglamento Interno "
    "de la Comisión Nacional de Telecomunicaciones y demás normativa aplicable."
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
            'presentado_a': PRESENTADO_A_DEFECTO,
            'cargo_presentado_a': CARGO_PRESENTADO_A_DEFECTO,
            'presentado_por': PRESENTADO_POR_DEFECTO,
            'cargo_presentado_por': CARGO_PRESENTADO_POR_DEFECTO,
            'unidad': UNIDAD_DEFECTO,
            'asunto': ASUNTO_DEFECTO,
            'exposicion': EXPOSICION_DEFECTO,
            'propuesta': PROPUESTA_DEFECTO,
            'base_legal': BASE_LEGAL_DEFECTO,
            'observaciones_texto': '',
            'incluir_presentado_a': True,
            'incluir_presentado_por': True,
            'incluir_asunto': True,
            'incluir_exposicion': True,
            'incluir_propuesta': True,
            'incluir_base_legal': True,
            'incluir_decision': True,
            'incluir_observaciones': True,
            'incluir_tabla_resumen': False,
            'incluir_firmas': True,
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

    plantillas_map = dict(getattr(cfg, 'plantillas_procesos', None) or {})
    cfg_gen = plantillas_map.get('general') or {}

    asunto_val = cfg_gen.get('asunto') if 'asunto' in cfg_gen else (cfg.encabezado or ASUNTO_DEFECTO)
    exposicion_val = cfg_gen.get('exposicion') if 'exposicion' in cfg_gen else (cfg.cuerpo or EXPOSICION_DEFECTO)
    propuesta_val = cfg_gen.get('propuesta') if 'propuesta' in cfg_gen else PROPUESTA_DEFECTO
    base_legal_val = cfg_gen.get('base_legal') if 'base_legal' in cfg_gen else BASE_LEGAL_DEFECTO

    return {
        'id': str(cfg.pk),
        'generar': generar,
        'procesos_habilitados': procesos,
        'titulo': cfg.titulo or TITULO_POR_DEFECTO,
        'encabezado': cfg.encabezado if cfg.encabezado is not None else ENCABEZADO_POR_DEFECTO,
        'cuerpo': cfg.cuerpo if cfg.cuerpo is not None else CUERPO_POR_DEFECTO,
        'presentado_a': cfg_gen.get('presentado_a', PRESENTADO_A_DEFECTO),
        'cargo_presentado_a': cfg_gen.get('cargo_presentado_a', CARGO_PRESENTADO_A_DEFECTO),
        'presentado_por': cfg_gen.get('presentado_por', PRESENTADO_POR_DEFECTO),
        'cargo_presentado_por': cfg_gen.get('cargo_presentado_por', CARGO_PRESENTADO_POR_DEFECTO),
        'unidad': cfg_gen.get('unidad', UNIDAD_DEFECTO),
        'asunto': asunto_val,
        'exposicion': exposicion_val,
        'propuesta': propuesta_val,
        'base_legal': base_legal_val,
        'observaciones_texto': cfg_gen.get('observaciones_texto', ''),
        'incluir_presentado_a': bool(cfg_gen.get('incluir_presentado_a', True)),
        'incluir_presentado_por': bool(cfg_gen.get('incluir_presentado_por', True)),
        'incluir_asunto': bool(cfg_gen.get('incluir_asunto', True)),
        'incluir_exposicion': bool(cfg_gen.get('incluir_exposicion', True)),
        'incluir_propuesta': bool(cfg_gen.get('incluir_propuesta', True)),
        'incluir_base_legal': bool(cfg_gen.get('incluir_base_legal', True)),
        'incluir_decision': bool(cfg_gen.get('incluir_decision', True)),
        'incluir_observaciones': bool(cfg_gen.get('incluir_observaciones', True)),
        'incluir_tabla_resumen': bool(cfg_gen.get('incluir_tabla_resumen', False)),
        'incluir_firmas': bool(cfg_gen.get('incluir_firmas', True)),
        'firmas': list(cfg.firmas) if cfg.firmas is not None else list(FIRMAS_POR_DEFECTO),
        'mostrar_nivel': bool(cfg.mostrar_nivel),
        'plantillas_procesos': plantillas_map,
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

        gen_actual = plantillas.get('general', {})
        if not isinstance(gen_actual, dict):
            gen_actual = {}

        campos_seccion = [
            'presentado_a', 'cargo_presentado_a', 'presentado_por', 'cargo_presentado_por',
            'unidad', 'asunto', 'exposicion', 'propuesta', 'base_legal', 'observaciones_texto',
            'incluir_presentado_a', 'incluir_presentado_por', 'incluir_asunto', 'incluir_exposicion',
            'incluir_propuesta', 'incluir_base_legal', 'incluir_decision', 'incluir_observaciones',
            'incluir_tabla_resumen', 'incluir_firmas',
        ]
        for c in campos_seccion:
            if c in datos:
                gen_actual[c] = datos[c]
        plantillas['general'] = gen_actual

        encabezado_str = str(
            datos.get('encabezado') if 'encabezado' in datos
            else (datos.get('asunto') if 'asunto' in datos
            else (cfg_actual.encabezado if cfg_actual else ENCABEZADO_POR_DEFECTO))
        )
        cuerpo_str = str(
            datos.get('cuerpo') if 'cuerpo' in datos
            else (datos.get('exposicion') if 'exposicion' in datos
            else (cfg_actual.cuerpo if cfg_actual else CUERPO_POR_DEFECTO))
        )

        ConfiguracionPuntoCuentaModel.objects.create(
            procesos_habilitados=procesos,
            titulo=str(datos.get('titulo') or (cfg_actual.titulo if cfg_actual else TITULO_POR_DEFECTO)).strip(),
            encabezado=encabezado_str,
            cuerpo=cuerpo_str,
            firmas=list(datos.get('firmas') if 'firmas' in datos else (cfg_actual.firmas if cfg_actual else FIRMAS_POR_DEFECTO)),
            mostrar_nivel=bool(datos.get('mostrar_nivel', cfg_actual.mostrar_nivel if cfg_actual else True)),
            plantillas_procesos=plantillas,
            version=nueva_version,
            actualizado_por_id=usuario_id,
        )

        return obtener_configuracion_activa()
