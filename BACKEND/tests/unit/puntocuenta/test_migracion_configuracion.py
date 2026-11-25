"""Respaldo y reversión de los campos editores retirados de la configuración."""
import importlib
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

MIGRACION_TRAZABILIDAD = importlib.import_module('apps.puntocuenta.migrations.0006_punto_cuenta_proceso_documento')
MIGRACION_RESPALDO = importlib.import_module('apps.puntocuenta.migrations.0008_configuracion_sin_textos')
MIGRACION_PLANTILLAS = importlib.import_module('apps.puntocuenta.migrations.0007_plantillas_punto_cuenta_datos')


def _apps(config, respaldo):
    apps = MagicMock()
    apps.get_model.side_effect = lambda app, modelo: {
        'ConfiguracionPuntoCuentaModel': config,
        'RespaldoConfiguracionPuntoCuentaModel': respaldo,
    }[modelo]
    return apps


def test_respaldo_guarda_todos_los_campos_retirados_de_cada_fila():
    datos = {
        'titulo': 'PUNTO DE CUENTA',
        'encabezado': 'Aviso',
        'cuerpo': 'Cuerpo',
        'firmas': [{'cargo': 'Director(a)', 'nombre': 'ANA'}],
        'mostrar_nivel': False,
        'plantillas_procesos': {'general': {'asunto': 'Asunto'}},
    }
    fila = SimpleNamespace(pk='uuid-config', **datos)
    config = MagicMock()
    config.objects.all.return_value = [fila]
    respaldo = MagicMock()
    MIGRACION_RESPALDO._respaldo(_apps(config, respaldo), None)
    respaldo.objects.update_or_create.assert_called_once_with(
        configuracion_id='uuid-config', defaults={'datos': datos},
    )


def test_revertir_restaura_los_valores_y_elimina_el_respaldo():
    fila = MagicMock(pk='uuid-config')
    respaldo_fila = SimpleNamespace(
        configuracion_id='uuid-config',
        datos={
            'titulo': 'PUNTO DE CUENTA',
            'encabezado': 'Aviso',
            'cuerpo': 'Cuerpo',
            'firmas': [{'cargo': 'Director(a)', 'nombre': 'ANA'}],
            'mostrar_nivel': False,
            'plantillas_procesos': {'general': {'asunto': 'Asunto'}},
        },
    )
    config = MagicMock()
    config.objects.filter.return_value.first.return_value = fila
    respaldo = MagicMock()
    consulta = MagicMock()
    consulta.__iter__.return_value = iter([respaldo_fila])
    respaldo.objects.all.return_value = consulta
    MIGRACION_RESPALDO._restaurar(_apps(config, respaldo), None)
    assert fila.titulo == 'PUNTO DE CUENTA' and fila.cuerpo == 'Cuerpo'
    assert fila.mostrar_nivel is False
    assert fila.save.call_args.kwargs['update_fields'] == [
        'titulo', 'encabezado', 'cuerpo', 'firmas', 'mostrar_nivel', 'plantillas_procesos', 'updated_at',
    ]
    consulta.delete.assert_called_once_with()


def test_no_se_revierte_la_trazabilidad_de_emisiones_nuevas():
    modelo = MagicMock()
    modelo.objects.filter.return_value.exists.return_value = True
    apps = MagicMock()
    apps.get_model.return_value = modelo
    with pytest.raises(RuntimeError, match='no perder su trazabilidad'):
        MIGRACION_TRAZABILIDAD._proteger_trazabilidad(apps, None)


def test_sin_configuracion_previa_se_congelan_los_defectos_del_caso_de_uso():
    config = MIGRACION_PLANTILLAS.configuracion_efectiva(None)
    assert config['titulo'] == 'PUNTO DE CUENTA'
    assert 'se notifica el siguiente movimiento' in config['encabezado']
    assert '{nombre}' in config['cuerpo']
    assert config['exposicion'] == MIGRACION_PLANTILLAS.EXPOSICION
    assert config['incluir_tabla_resumen'] is False
    assert config['incluir_decision'] is True
