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
    for campo in (
        'password_hash', 'Contraseña', 'access-token', 'jwt', 'api_key',
        'apiKey', 'refreshToken', 'clave', 'clave_acceso', 'claveTemporal',
        'clave_secreta', 'clavePrivada',
    ):
        assert es_campo_sensible(campo), campo
    assert not es_campo_sensible('nombre_completo')
    assert not es_campo_sensible('clave_postal')


def test_diferencias_enmascara_secretos_dentro_de_listas():
    """M1: aplanar listas con índice evita que un secreto de una lista salga en claro."""
    previo = {'a': [{'password': 'x1'}]}
    nuevo = {'a': [{'password': 'x2'}]}

    cambios = diferencias(previo, nuevo)

    assert cambios == [{'campo': 'a.0.password', 'antes': '***', 'despues': '***'}]


def test_diferencias_con_listas_anidadas_y_diccionarios_dentro_de_listas():
    previo = {
        'items': [
            {'clave': 'uno', 'meta': {'refreshToken': 'r1'}},
            ['texto', {'apiKey': 'k1'}],
        ],
        'normal': 'igual',
    }
    nuevo = {
        'items': [
            {'clave': 'dos', 'meta': {'refreshToken': 'r2'}},
            ['texto', {'apiKey': 'k2'}],
        ],
        'normal': 'igual',
    }

    cambios = diferencias(previo, nuevo)

    assert {c['campo'] for c in cambios} == {
        'items.0.clave', 'items.0.meta.refreshToken', 'items.1.1.apiKey',
    }
    assert all(c['antes'] == c['despues'] == '***' for c in cambios)


def test_diferencias_solo_devuelve_lo_que_cambio_y_sanea():
    previo = {'nombres': 'Ana', 'password': 'uno', 'anidado': {'valor': 1}}
    nuevo = {'nombres': 'Ana María', 'password': 'dos', 'anidado': {'valor': 2}}

    cambios = {d['campo']: d for d in diferencias(previo, nuevo)}

    assert set(cambios) == {'nombres', 'password', 'anidado.valor'}
    assert cambios['nombres'] == {'campo': 'nombres', 'antes': 'Ana', 'despues': 'Ana María'}
    assert cambios['password']['antes'] == '***'
    assert cambios['password']['despues'] == '***'
