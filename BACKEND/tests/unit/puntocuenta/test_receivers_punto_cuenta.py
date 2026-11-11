"""
Receivers y servicio de decisión de Punto de Cuenta:
- interruptor `puntocuenta.generar`
- disparo configurable (por defecto solo cambio de oficina, RN-006-01)
- cambio de cargo en la misma oficina no genera por defecto
- activar en configuración «cambio de cargo» y entonces sí genera
- correlativo y formato con variables.
Sin BD ni Docker.
"""
from unittest.mock import MagicMock, patch

import pytest

from apps.puntocuenta.domain.services.decision_punto_cuenta import evaluar_generacion_punto_cuenta
from apps.puntocuenta.infrastructure import receivers as r
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import _reemplazar_variables


def _lector(activo: bool):
    lector = MagicMock()
    lector.obtener_booleano.return_value = activo
    return lector


@pytest.fixture
def generar():
    config = {
        'version': 1,
        'procesos_habilitados': {
            'cambio_oficina': True, 'cambio_nivel': False, 'cambio_division': False,
            'cambio_cargo_misma_oficina': False, 'egreso_activo': False,
            'pase_a_pasivo': False, 'encargaduria_prestamo': False, 'cambio_estatus': False,
        },
    }
    with patch.object(r, 'RepoPuntoCuentaORM'), \
         patch.object(r, 'generar_punto_cuenta') as gen, \
         patch.object(r, 'adjuntar_documento_punto_cuenta'), \
         patch.object(r, 'obtener_configuracion_activa', return_value=config), \
         patch.object(r, 'obtener_siguiente_correlativo', return_value=(1, '0001-2026')):
        gen.return_value = MagicMock(id=1, numero='0001-2026')
        yield gen


def _actualizacion(**kw):
    base = dict(
        cargo_id=1, cedula='123', dependencia_anterior_id=1, dependencia_nueva_id=1,
        oficina_anterior_id=5, oficina_nueva_id=6, motivo_id=None, usuario_id=9,
    )
    base.update(kw)
    return r.despachar_punto_cuenta_por_actualizacion(sender=None, **base)


def _traslado(**kw):
    base = dict(
        cargo_id=1, cedula='123', tipo_movimiento='TRASLADO', motivo_id=3, usuario_id=9,
        dependencia_anterior_id=1, dependencia_nueva_id=1, oficina_anterior_id=5, oficina_nueva_id=6,
    )
    base.update(kw)
    return r.despachar_punto_cuenta_por_traslado(sender=None, **base)


def test_interruptor_apagado_no_genera(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(False)):
        _actualizacion()
        _traslado()
    generar.assert_not_called()


def test_encendido_cambio_de_oficina_en_el_mismo_nivel_genera_con_las_oficinas(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _actualizacion(dependencia_anterior_id=1, dependencia_nueva_id=1, oficina_anterior_id=5, oficina_nueva_id=6)
    generar.assert_called_once()
    kw = generar.call_args.kwargs
    assert kw['oficina_origen_id'] == 5 and kw['oficina_destino_id'] == 6
    assert kw['dependencia_origen_id'] == 1 and kw['dependencia_destino_id'] == 1
    assert kw['numero'] == '0001-2026'


def test_misma_oficina_no_genera_aunque_cambie_el_nivel_por_defecto(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _actualizacion(dependencia_anterior_id=1, dependencia_nueva_id=2, oficina_anterior_id=5, oficina_nueva_id=5)
    generar.assert_not_called()


def test_traslado_entre_oficinas_genera(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _traslado()
    generar.assert_called_once()
    assert generar.call_args.kwargs['oficina_destino_id'] == 6


def test_traslado_misma_oficina_u_otro_tipo_no_genera_por_defecto(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _traslado(oficina_anterior_id=5, oficina_nueva_id=5)
        _traslado(tipo_movimiento='INGRESO')
    generar.assert_not_called()


def test_sin_trabajador_no_genera(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _actualizacion(cedula=None)
    generar.assert_not_called()


def test_cambio_cargo_misma_oficina_no_genera_por_defecto(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _traslado(oficina_anterior_id=5, oficina_nueva_id=5, cargo_anterior_id=10, cargo_id=11)
    generar.assert_not_called()


def test_activar_cambio_cargo_en_configuracion_genera(generar):
    config_custom = {
        'version': 2,
        'procesos_habilitados': {
            'cambio_oficina': True,
            'cambio_cargo_misma_oficina': True,
        },
    }
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)), \
         patch.object(r, 'obtener_configuracion_activa', return_value=config_custom):
        _traslado(oficina_anterior_id=5, oficina_nueva_id=5, cargo_anterior_id=10, cargo_id=11)
    generar.assert_called_once()


def test_evaluar_generacion_servicio_dominio():
    # Interruptor apagado
    assert not evaluar_generacion_punto_cuenta(
        generacion_activa=False,
        cedula='123',
        procesos={'cambio_oficina': True},
        oficina_origen_id=1,
        oficina_destino_id=2,
    )

    # Interruptor encendido, cambio de oficina habilitado
    assert evaluar_generacion_punto_cuenta(
        generacion_activa=True,
        cedula='123',
        procesos={'cambio_oficina': True},
        oficina_origen_id=1,
        oficina_destino_id=2,
    )

    # Misma oficina, cambio de cargo no habilitado
    assert not evaluar_generacion_punto_cuenta(
        generacion_activa=True,
        cedula='123',
        procesos={'cambio_oficina': True, 'cambio_cargo_misma_oficina': False},
        oficina_origen_id=1,
        oficina_destino_id=1,
        cargo_origen_id=10,
        cargo_destino_id=20,
    )

    # Misma oficina, cambio de cargo habilitado
    assert evaluar_generacion_punto_cuenta(
        generacion_activa=True,
        cedula='123',
        procesos={'cambio_oficina': True, 'cambio_cargo_misma_oficina': True},
        oficina_origen_id=1,
        oficina_destino_id=1,
        cargo_origen_id=10,
        cargo_destino_id=20,
    )


def test_reemplazo_variables_formato():
    plantilla = "El funcionario {nombre} (C.I. {cedula}) pasa a {destino} bajo N.º {numero}."
    variables = {
        'nombre': 'CARLOS PÉREZ',
        'cedula': 'V-12345678',
        'destino': 'GERENCIA DE TECNOLOGÍA',
        'numero': '0005-2026',
    }
    resultado = _reemplazar_variables(plantilla, variables)
    assert resultado == "El funcionario CARLOS PÉREZ (C.I. V-12345678) pasa a GERENCIA DE TECNOLOGÍA bajo N.º 0005-2026."
