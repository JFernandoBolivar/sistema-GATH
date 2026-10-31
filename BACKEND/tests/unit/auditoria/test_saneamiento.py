"""Saneamiento y diferencias de la bitácora (D10), sin Django."""
from core.domain.auditoria import diferencias, es_campo_sensible, sanear_estado


def test_los_campos_sensibles_se_enmascaran_en_cualquier_nivel():
    estado = {
        'nombre': 'Ana',
        'password': 'secreto',
        'datos': {'access_token': 'abc', 'telefono': '0414'},
        'lista': [{'refresh_token': 'xyz', 'valor': 1}],
    }
    saneado = sanear_estado(estado)

    assert saneado['password'] == '***'
    assert saneado['datos']['access_token'] == '***'
    assert saneado['lista'][0]['refresh_token'] == '***'
    assert saneado['datos']['telefono'] == '0414'
    assert saneado['nombre'] == 'Ana'


def test_los_nombres_de_campo_sensibles_se_reconocen_por_variantes():
    for campo in ('password_hash', 'Contraseña', 'access-token', 'jwt', 'api_key'):
        assert es_campo_sensible(campo), campo
    assert not es_campo_sensible('nombre_completo')


def test_diferencias_solo_devuelve_lo_que_cambio_y_sanea():
    previo = {'nombres': 'Ana', 'password': 'uno', 'anidado': {'valor': 1}}
    nuevo = {'nombres': 'Ana María', 'password': 'dos', 'anidado': {'valor': 2}}

    cambios = {d['campo']: d for d in diferencias(previo, nuevo)}

    assert set(cambios) == {'nombres', 'password', 'anidado.valor'}
    assert cambios['nombres'] == {'campo': 'nombres', 'antes': 'Ana', 'despues': 'Ana María'}
    assert cambios['password']['antes'] == '***'
    assert cambios['password']['despues'] == '***'
