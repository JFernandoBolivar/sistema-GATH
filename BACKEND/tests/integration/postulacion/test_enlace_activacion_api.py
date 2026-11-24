"""Enlace de activación del postulante (D-10) por la API, contra la BD: envío, activación, errores, seguridad y auditoría."""
import hashlib
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.enlace_activacion_models import EnlaceActivacionModel
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import Notificador
from tests.integration.postulacion._ventana2_mundo import instalar_dobles_g
from tests.integration.postulacion.test_postulacion_api import BASE, Personal, acceso, codigo

pytestmark = pytest.mark.django_db

CEDULA = '12345678'
CORREO = 'juan.perez@ejemplo.invalid'
CLAVE = 'Clave-nueva-2026'


@pytest.fixture(autouse=True)
def dobles(monkeypatch):
    instalar_dobles_g(monkeypatch)


@pytest.fixture
def captacion():
    c = APIClient()
    c.force_authenticate(user=Personal())
    return c


@pytest.fixture
def anonimo():
    return APIClient()


def alta_correo(captacion, commit, cedula=CEDULA, correo=CORREO, entrega='correo'):
    with commit(execute=True):
        r = captacion.post(f'{BASE}/postulantes/', {
            'cedula': cedula, 'nombres': 'Juan', 'apellidos': 'Pérez', 'correo': correo, 'entrega': entrega}, format='json')
    return r


def token_del_ultimo_correo():
    return parse_qs(urlparse(Notificador.correos[-1].enlace).query)['t'][0]


def activar(anonimo, token, cedula=CEDULA, clave=CLAVE):
    return anonimo.post(f'{BASE}/activar/', {'token': token, 'cedula': cedula, 'clave_nueva': clave}, format='json')


def validar(anonimo, token):
    return anonimo.get(f'{BASE}/activar/', {'t': token})


@pytest.fixture
def con_enlace(captacion, django_capture_on_commit_callbacks):
    r = alta_correo(captacion, django_capture_on_commit_callbacks)
    assert r.status_code == 201, r.content
    return r.json()['data'], token_del_ultimo_correo()


# ----------------------------------------------------------------------------------------------- envío
def test_alta_por_correo_no_devuelve_clave_y_enmascara_el_correo(captacion):
    r = captacion.post(f'{BASE}/postulantes/', {
        'cedula': CEDULA, 'nombres': 'Juan', 'apellidos': 'Pérez', 'correo': CORREO, 'entrega': 'correo'}, format='json')
    assert r.status_code == 201, r.content
    assert Notificador.correos == []   # nada sale antes del commit
    d = r.json()['data']['credencial']
    assert 'clave_temporal' not in d and d['enlace']['enviado_a'] == 'ju***@ejemplo.invalid' and d['enlace']['vence_el']
    assert CORREO not in str(d)   # la credencial solo lleva el correo enmascarado


def test_el_correo_sale_tras_el_commit_y_no_lleva_clave_ni_cedula(captacion, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=False) as pendientes:
        r = captacion.post(f'{BASE}/postulantes/', {
            'cedula': CEDULA, 'nombres': 'Juan', 'apellidos': 'Pérez', 'correo': CORREO, 'entrega': 'correo'}, format='json')
    assert r.status_code == 201 and Notificador.correos == [] and pendientes
    for accion in pendientes:
        accion()
    assert len(Notificador.correos) == 1
    c = Notificador.correos[0]
    assert c.destinatario_correo == CORREO and c.enlace.startswith('/postulacion/activar?t=')
    texto = f'{c.asunto} {c.titulo} {c.mensaje}'
    assert CEDULA not in texto and 'temporal' not in texto and 'contraseña:' not in texto.lower()
    assert 'N.º EXP-' in c.mensaje and 'una sola vez' in c.mensaje and 'ignora este mensaje' in c.mensaje


def test_en_la_base_solo_esta_el_hash_del_token(con_enlace):
    _, token = con_enlace
    assert len(token) >= 43
    fila = EnlaceActivacionModel.objects.get()
    assert fila.token_hash == hashlib.sha256(token.encode()).hexdigest()
    for valor in fila.__dict__.values():
        assert token not in str(valor)
    assert fila.correo_destino == CORREO and fila.creado_por == '20000001' and fila.usado_el is None and fila.intentos == 0


def test_vence_por_el_parametro_y_nunca_despues_de_la_ventana(captacion, django_capture_on_commit_callbacks):
    alta_correo(captacion, django_capture_on_commit_callbacks)
    fila = EnlaceActivacionModel.objects.get()
    assert abs((fila.vence_el - fila.creado_el).total_seconds() - 48 * 3600) < 60
    cerca = timezone.now() + timedelta(hours=5)
    ExpedientePostulacionModel.objects.update(ventana_vence_el=cerca)
    CredencialPostulanteModel.objects.update(vence_el=cerca)
    exp = str(ExpedientePostulacionModel.objects.get().pk)
    with django_capture_on_commit_callbacks(execute=True):
        r = captacion.post(f'{BASE}/expedientes/{exp}/enviar-enlace/')
    assert r.status_code == 200, r.content
    assert EnlaceActivacionModel.objects.order_by('-creado_el').first().vence_el <= cerca


def test_enviar_enlace_exige_permiso(con_enlace):
    exp = con_enlace[0]['expediente']['id']
    c = APIClient()
    c.force_authenticate(user=Personal(permisos=()))
    assert c.post(f'{BASE}/expedientes/{exp}/enviar-enlace/').status_code == 403
    assert APIClient().post(f'{BASE}/expedientes/{exp}/enviar-enlace/').status_code in (401, 403)


def test_sin_correo_es_409_y_el_alta_no_deja_nada_a_medias(captacion, django_capture_on_commit_callbacks):
    r = alta_correo(captacion, django_capture_on_commit_callbacks, correo='')
    assert r.status_code == 409 and codigo(r) == 'SIN_CORREO'
    assert not PostulanteModel.objects.exists() and not EnlaceActivacionModel.objects.exists()
    r = alta_correo(captacion, django_capture_on_commit_callbacks, correo='', entrega='persona')
    assert r.status_code == 201
    exp = r.json()['data']['expediente']['id']
    r = captacion.post(f'{BASE}/expedientes/{exp}/enviar-enlace/')
    assert r.status_code == 409 and codigo(r) == 'SIN_CORREO'


def test_con_la_ventana_cerrada_es_409(con_enlace, captacion):
    exp = con_enlace[0]['expediente']['id']
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='ENVIADO_CAPTACION')
    r = captacion.post(f'{BASE}/expedientes/{exp}/enviar-enlace/')
    assert r.status_code == 409 and codigo(r) == 'SIN_VENTANA_ABIERTA'


def test_entrega_invalida_es_400(captacion, django_capture_on_commit_callbacks):
    assert alta_correo(captacion, django_capture_on_commit_callbacks, entrega='paloma').status_code == 400


# ----------------------------------------------------------------------------------------------- activación
def test_flujo_feliz_activa_inicia_sesion_y_no_se_reusa(con_enlace, anonimo):
    datos, token = con_enlace
    r = validar(anonimo, token)
    assert r.status_code == 200 and r.json()['data']['valido'] is True and r.json()['data']['numero'].startswith('EXP-')
    assert EnlaceActivacionModel.objects.get().usado_el is None   # validar no consume
    r = activar(anonimo, token)
    assert r.status_code == 200, r.content
    s = r.json()['data']
    assert s['debe_cambiar_clave'] is False and s['expediente']['estado'] == 'EN_CAPTURA' and s['token'] and r['Cache-Control'] == 'no-store'
    # la sesión devuelta sirve
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {s['token']}")
    assert c.get(f'{BASE}/mi-expediente/').status_code == 200
    # el login normal con la contraseña elegida funciona
    assert acceso(anonimo, CEDULA, CLAVE).status_code == 200
    fila = EnlaceActivacionModel.objects.get()
    assert fila.usado_el is not None and fila.ip_uso == '127.0.0.1'
    # un solo uso
    assert validar(anonimo, token).status_code == 410 and codigo(validar(anonimo, token)) == 'ENLACE_USADO'
    r = activar(anonimo, token, clave='Otra-clave-2027')
    assert r.status_code == 410 and codigo(r) == 'ENLACE_USADO'
    assert acceso(anonimo, CEDULA, 'Otra-clave-2027').status_code == 401


def test_historial_y_auditoria_sin_token_ni_clave(con_enlace, anonimo, captacion):
    datos, token = con_enlace
    activar(anonimo, token)
    exp = datos['expediente']['id']
    tipos = [t.datos_extra.get('tipo') for t in TransicionExpedienteModel.objects.filter(expediente_id=exp).order_by('fecha', 'created_at')]
    assert 'ENLACE_ACTIVACION_ENVIADO' in tipos and 'ENLACE_ACTIVACION_USADO' in tipos
    enviado = TransicionExpedienteModel.objects.get(expediente_id=exp, datos_extra__tipo='ENLACE_ACTIVACION_ENVIADO')
    assert enviado.estado_origen == enviado.estado_destino and enviado.datos_extra['correo_enmascarado'] == 'ju***@ejemplo.invalid'
    assert CORREO not in str(enviado.datos_extra)
    for accion in ('ENLACE_ACTIVACION_ENVIADO', 'POSTULANTE_ENLACE_USADO'):
        fila = AuditoriaLog.objects.get(accion=accion)
        volcado = ' '.join(str(v) for v in fila.__dict__.values())
        assert token not in volcado and CLAVE not in volcado and CORREO not in volcado
    uso = AuditoriaLog.objects.get(accion='POSTULANTE_ENLACE_USADO')
    assert uso.ip_origen == '127.0.0.1' and uso.actor_cedula == CEDULA
    envio = AuditoriaLog.objects.get(accion='ENLACE_ACTIVACION_ENVIADO')
    assert envio.actor_cedula == '20000001' and envio.estado_nuevo['enviado_a'] == 'ju***@ejemplo.invalid'


def test_enlace_vencido(con_enlace, anonimo):
    _, token = con_enlace
    EnlaceActivacionModel.objects.update(vence_el=timezone.now() - timedelta(minutes=1))
    r = validar(anonimo, token)
    assert r.status_code == 410 and codigo(r) == 'ENLACE_VENCIDO'
    assert activar(anonimo, token).status_code == 410


def test_token_inventado_es_invalido(anonimo):
    for t in ('', 'x', 'a' * 43):
        r = validar(anonimo, t)
        assert r.status_code == 404 and codigo(r) == 'ENLACE_INVALIDO'
    r = activar(anonimo, 'a' * 43)
    assert r.status_code == 404 and codigo(r) == 'ENLACE_INVALIDO'


def test_cedula_equivocada_es_generica_cuenta_intentos_y_bloquea_a_los_cinco(con_enlace, anonimo):
    _, token = con_enlace
    for n in range(4):
        r = activar(anonimo, token, cedula='87654321')
        assert r.status_code == 400 and codigo(r) == 'ACTIVACION_DATOS_INCORRECTOS', n
        assert CEDULA not in r.content.decode()
    assert EnlaceActivacionModel.objects.get().intentos == 4
    r = activar(anonimo, token, cedula='87654321')
    assert r.status_code == 403 and codigo(r) == 'ENLACE_BLOQUEADO'
    r = activar(anonimo, token)   # ni con la cédula correcta
    assert r.status_code == 403 and codigo(r) == 'ENLACE_BLOQUEADO'
    assert codigo(validar(anonimo, token)) == 'ENLACE_BLOQUEADO'
    assert EnlaceActivacionModel.objects.get().usado_el is None
    assert acceso(anonimo, CEDULA, CLAVE).status_code == 401


def test_clave_debil_se_rechaza_sin_consumir_el_enlace(con_enlace, anonimo):
    _, token = con_enlace
    for clave in ('corta1', 'sololetrasenlaclave', f'Clave{CEDULA}xx'):
        assert activar(anonimo, token, clave=clave).status_code == 400, clave
    fila = EnlaceActivacionModel.objects.get()
    assert fila.usado_el is None and fila.intentos == 0
    assert activar(anonimo, token).status_code == 200


def test_reenviar_invalida_el_anterior_y_la_clave_temporal(captacion, anonimo, django_capture_on_commit_callbacks):
    # alta en persona (tiene clave temporal) y luego se manda el enlace
    r = alta_correo(captacion, django_capture_on_commit_callbacks, entrega='persona')
    temporal = r.json()['data']['credencial']['clave_temporal']
    exp = r.json()['data']['expediente']['id']
    with django_capture_on_commit_callbacks(execute=True):
        assert captacion.post(f'{BASE}/expedientes/{exp}/enviar-enlace/').status_code == 200
    primero = token_del_ultimo_correo()
    assert acceso(anonimo, CEDULA, temporal).status_code == 401   # la temporal previa cayó
    with django_capture_on_commit_callbacks(execute=True):
        r = captacion.post(f'{BASE}/expedientes/{exp}/enviar-enlace/')
    assert r.status_code == 200 and r.json()['data']['enviado_a'] == 'ju***@ejemplo.invalid'
    segundo = token_del_ultimo_correo()
    assert primero != segundo and len(Notificador.correos) == 2
    r = activar(anonimo, primero)
    assert r.status_code == 404 and codigo(r) == 'ENLACE_INVALIDO'
    assert activar(anonimo, segundo).status_code == 200


def test_elegir_en_persona_despues_invalida_el_enlace_pendiente(con_enlace, captacion, anonimo):
    datos, token = con_enlace
    exp = datos['expediente']['id']
    r = captacion.post(f'{BASE}/expedientes/{exp}/reponer-credencial/')
    assert r.status_code == 200 and r.json()['data']['clave_temporal']
    assert codigo(validar(anonimo, token)) == 'ENLACE_INVALIDO'
    assert activar(anonimo, token).status_code == 404
    assert TransicionExpedienteModel.objects.filter(expediente_id=exp, datos_extra__tipo='ENLACE_ACTIVACION_REVOCADO').exists()


def test_activar_cae_si_el_expediente_ya_no_admite_acceso(con_enlace, anonimo):
    datos, token = con_enlace
    ExpedientePostulacionModel.objects.filter(pk=datos['expediente']['id']).update(estado='ENVIADO_CAPTACION')
    assert codigo(validar(anonimo, token)) == 'ENLACE_INVALIDO'
    assert activar(anonimo, token).status_code == 404


def test_limite_de_tasa_en_los_endpoints_publicos(anonimo, monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {**ScopedRateThrottle.THROTTLE_RATES, 'login': '3/min'})
    estados = [validar(anonimo, f'token-{n}').status_code for n in range(5)]
    assert estados == [404, 404, 404, 429, 429]


def test_el_acceso_normal_sigue_igual(captacion, anonimo):
    r = captacion.post(f'{BASE}/postulantes/', {'cedula': CEDULA, 'nombres': 'Juan', 'apellidos': 'Pérez'}, format='json')
    d = r.json()['data']['credencial']
    assert d['clave_temporal'] and 'enlace' not in d and not EnlaceActivacionModel.objects.exists()
    s = acceso(anonimo, CEDULA, d['clave_temporal']).json()['data']
    assert s['debe_cambiar_clave'] is True


# ----------------------------------------------------------------------------------------------- detalle de Captación
def test_el_detalle_muestra_el_ultimo_enlace_enmascarado(con_enlace):
    datos, token = con_enlace
    c = APIClient()
    c.force_authenticate(user=Personal(permisos=('postulacion.ver_bandeja',)))
    r = c.get(f"{BASE}/expedientes/{datos['expediente']['id']}/")
    assert r.status_code == 200, r.content
    d = r.json()['data']
    assert d['enlace_activacion']['estado'] == 'PENDIENTE' and d['enlace_activacion']['enviado_a'] == 'ju***@ejemplo.invalid'
    assert token not in r.content.decode() and CORREO not in str(d['enlace_activacion'])
    assert any(h['tipo'] == 'ENLACE_ACTIVACION_ENVIADO' and h['correo_enmascarado'] for h in d['historial'])


# ----------------------------------------------------------------------------------------------- reapertura de la Ventana 2
def test_reabrir_la_ventana_2_por_correo_no_devuelve_clave_y_envia_el_enlace(mundo, anonimo, django_capture_on_commit_callbacks):
    from tests.integration.postulacion._ventana2_mundo import Mundo2
    from tests.integration.postulacion.test_captacion_g_api import aprobado

    m2 = Mundo2(mundo)
    exp = aprobado(m2, CEDULA, CORREO)
    c = m2.captacion()
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': 'CONSOLIDANDO', 'entrega': 'correo'}, format='json')
    assert r.status_code == 200, r.content
    cred = r.json()['data']['credencial']
    assert 'clave_temporal' not in cred and cred['enlace']['enviado_a'] == 'ju***@ejemplo.invalid'
    assert any(x.enlace.startswith('/postulacion/activar?t=') for x in Notificador.correos)
    s = activar(anonimo, token_del_ultimo_correo())
    assert s.status_code == 200 and s.json()['data']['expediente']['estado'] == 'CONSOLIDANDO'
    assert s.json()['data']['expediente']['ventana'] == 2
