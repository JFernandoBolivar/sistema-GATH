"""
Receivers de Punto de Cuenta: interruptor `puntocuenta.generar` y disparo solo
por cambio de Gerencia/Oficina (RN-006-01). Sin BD: se parchean el lector de
configuracion y el caso de uso de generacion.
"""
from unittest.mock import MagicMock, patch

import pytest

from apps.puntocuenta.infrastructure import receivers as r


def _lector(activo: bool):
    lector = MagicMock()
    lector.obtener_booleano.return_value = activo
    return lector


@pytest.fixture
def generar():
    with patch.object(r, 'RepoPuntoCuentaORM'), \
         patch.object(r, 'generar_punto_cuenta') as gen, \
         patch.object(r, 'adjuntar_documento_punto_cuenta'):
        gen.return_value = MagicMock(id=1)
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


def test_misma_oficina_no_genera_aunque_cambie_el_nivel(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _actualizacion(dependencia_anterior_id=1, dependencia_nueva_id=2, oficina_anterior_id=5, oficina_nueva_id=5)
    generar.assert_not_called()


def test_traslado_entre_oficinas_genera(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _traslado()
    generar.assert_called_once()
    assert generar.call_args.kwargs['oficina_destino_id'] == 6


def test_traslado_misma_oficina_u_otro_tipo_no_genera(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _traslado(oficina_anterior_id=5, oficina_nueva_id=5)
        _traslado(tipo_movimiento='INGRESO')
    generar.assert_not_called()


def test_sin_trabajador_no_genera(generar):
    with patch.object(r, 'obtener_lector_configuracion', return_value=_lector(True)):
        _actualizacion(cedula=None)
    generar.assert_not_called()
