"""API de postulación (D-4): acceso del postulante, aislamiento de tokens, Zero-IDOR, borrador/envío y alta de Captación."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from apps.postulacion.infrastructure.tokens.sesion_invitado import emitir_token_invitado
from apps.postulacion.presentation.authentication import SesionPostulante
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/postulacion'
CLAVE_NUEVA = 'Clave-nueva-2026'
DATOS_OK = {'fecha_nacimiento': '1990-05-17', 'sexo': 'F'}


class Personal:
    """Usuario de personal falso: `tiene_permiso` decide por código (el mismo contrato que `CuentaModel`)."""

    is_authenticated = True
    is_active = True
    rol_id = None
    id = None

    def __init__(self, permisos=('postulacion.crear_postulante',), cedula='20000001'):
        self.pk = 1
        self.cedula_id = cedula
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


@pytest.fixture
def captacion():
    c = APIClient()
    c.force_authenticate(user=Personal())
    return c


@pytest.fixture
def anonimo():
    return APIClient()


def alta(captacion, cedula='12345678', **extra):
    r = captacion.post(f'{BASE}/postulantes/', {
        'cedula': cedula, 'nombres': 'Ana María', 'apellidos': 'Pérez', **extra}, format='json')
    assert r.status_code == 201, r.content
    return r.json()['data']


def acceso(cliente, cedula, clave):
    return cliente.post(f'{BASE}/acceso/', {'cedula': cedula, 'password': clave}, format='json')


def invitado(anonimo, captacion, cedula='12345678', cambiar=True):
    """Alta + acceso (+ cambio de clave). Devuelve (cliente con Bearer, datos del alta, token)."""
    datos = alta(captacion, cedula)
    r = acceso(anonimo, cedula, datos['credencial']['clave_temporal'])
    assert r.status_code == 200, r.content
    token = r.json()['data']['token']
    if cambiar:
        r = anonimo.post(f'{BASE}/cambiar-clave/', {
            'clave_actual': datos['credencial']['clave_temporal'], 'clave_nueva': CLAVE_NUEVA},
            format='json', HTTP_AUTHORIZATION=f'Bearer {token}')
        assert r.status_code == 200, r.content
        token = r.json()['data']['token']
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return cliente, datos, token


def codigo(r):
    return (r.json().get('data') or {}).get('codigo')


# ---------------------------------------------------------------- alta por Captación
def test_alta_con_permiso_crea_postulante_expediente_y_credencial(captacion):
    d = alta(captacion, correo='ana@example.com', telefono_movil='0412-1234567')
    assert d['expediente']['estado'] == 'PRE_REGISTRADO' and d['expediente']['ventana'] == 1
    assert d['postulante']['telefono_movil'] == '+584121234567' and not d['es_reingreso']
    c = d['credencial']
    assert c['usuario'] == '12345678' and len(c['clave_temporal']) >= 10 and c['debe_cambiar_clave'] is True
    assert PostulanteModel.objects.filter(cedula='12345678').count() == 1
    fila = CredencialPostulanteModel.objects.get(usuario='12345678')
    assert fila.emitida_por == '20000001' and fila.clave_hash != c['clave_temporal']


def test_la_clave_temporal_viaja_una_vez_sin_cache_y_no_queda_en_la_auditoria(captacion):
    r = captacion.post(f'{BASE}/postulantes/', {'cedula': '12345678', 'nombres': 'Ana', 'apellidos': 'Pérez'},
                       format='json')
    clave = r.json()['data']['credencial']['clave_temporal']
    assert r['Cache-Control'] == 'no-store'
    filas = AuditoriaLog.objects.filter(modulo='postulacion', accion='POSTULANTE_CREADO')
    assert filas.count() == 1
    assert clave not in ' '.join(str(v) for v in filas.values().first().values())
    assert filas.first().estado_nuevo['cedula'] == '12345678'


def test_alta_sin_permiso_o_sin_sesion_se_rechaza(anonimo):
    sin_permiso = APIClient()
    sin_permiso.force_authenticate(user=Personal(permisos=('postulacion.verificar',)))
    r = sin_permiso.post(f'{BASE}/postulantes/', {'cedula': '12345678', 'nombres': 'A', 'apellidos': 'B'}, format='json')
    assert r.status_code == 403
    assert anonimo.post(f'{BASE}/postulantes/', {'cedula': '12345678', 'nombres': 'A', 'apellidos': 'B'},
                        format='json').status_code in (401, 403)
    assert not PostulanteModel.objects.exists()


def test_alta_valida_la_entrada_y_rechaza_un_segundo_expediente_abierto(captacion):
    r = captacion.post(f'{BASE}/postulantes/', {'cedula': 'ABC', 'nombres': 'Ana', 'apellidos': 'X'}, format='json')
    assert r.status_code == 400
    alta(captacion, '12345678')
    r = captacion.post(f'{BASE}/postulantes/', {'cedula': '12345678', 'nombres': 'Ana', 'apellidos': 'X'}, format='json')
    assert r.status_code == 409


def test_reponer_con_permiso_invalida_la_clave_anterior_y_la_sesion_abierta(anonimo, captacion):
    cliente, datos, token = invitado(anonimo, captacion, cambiar=False)
    exp_id = datos['expediente']['id']
    r = captacion.post(f'{BASE}/expedientes/{exp_id}/reponer-credencial/')
    assert r.status_code == 200 and r['Cache-Control'] == 'no-store'
    nueva = r.json()['data']['clave_temporal']
    assert nueva != datos['credencial']['clave_temporal'] and r.json()['data']['debe_cambiar_clave'] is True
    assert acceso(anonimo, '12345678', datos['credencial']['clave_temporal']).status_code == 401
    assert cliente.get(f'{BASE}/mi-expediente/').status_code == 401  # su sesión cayó con la reposición
    assert acceso(anonimo, '12345678', nueva).status_code == 200
    assert AuditoriaLog.objects.filter(accion='CREDENCIAL_REPUESTA').count() == 1
    assert nueva not in ' '.join(str(v) for v in AuditoriaLog.objects.filter(accion='CREDENCIAL_REPUESTA').values().first().values())


def test_reponer_exige_permiso_y_expediente_existente(captacion):
    exp_id = alta(captacion)['expediente']['id']
    sin_permiso = APIClient()
    sin_permiso.force_authenticate(user=Personal(permisos=()))
    assert sin_permiso.post(f'{BASE}/expedientes/{exp_id}/reponer-credencial/').status_code == 403
    assert captacion.post(f'{BASE}/expedientes/00000000-0000-0000-0000-000000000000/reponer-credencial/').status_code == 404


# ---------------------------------------------------------------- acceso
def test_acceso_correcto_devuelve_sesion_de_invitado_acotada(anonimo, captacion):
    datos = alta(captacion)
    r = acceso(anonimo, '12345678', datos['credencial']['clave_temporal'])
    assert r.status_code == 200
    s = r.json()['data']
    assert s['tipo'] == 'Bearer' and s['scope'] == f"expediente:{datos['expediente']['id']}"
    assert 0 < s['expira_en_segundos'] <= 2 * 3600 and s['debe_cambiar_clave'] is True
    assert s['expediente']['estado'] == 'EN_CAPTURA' and s['expediente']['ventana'] == 1
    assert r['Cache-Control'] == 'no-store'
    assert 'dj_access' not in r.cookies  # no se mezcla con la sesión de empleado
    historial = list(TransicionExpedienteModel.objects.filter(expediente_id=datos['expediente']['id'])
                     .values_list('estado_destino', 'actor_tipo'))
    assert historial == [('PRE_REGISTRADO', 'USUARIO'), ('EN_CAPTURA', 'POSTULANTE')]
    assert AuditoriaLog.objects.filter(accion='POSTULANTE_ACCESO', actor_cedula='12345678', actor_rol='POSTULANTE').exists()


def test_la_sesion_no_pasa_del_vencimiento_de_la_credencial(anonimo, captacion):
    datos = alta(captacion)
    cerca = timezone.now() + timedelta(minutes=20)
    CredencialPostulanteModel.objects.update(vence_el=cerca)
    ExpedientePostulacionModel.objects.update(ventana_vence_el=cerca)
    s = acceso(anonimo, '12345678', datos['credencial']['clave_temporal']).json()['data']
    assert 0 < s['expira_en_segundos'] <= 20 * 60


def test_acceso_incorrecto_es_generico_igual_exista_o_no_la_cedula(anonimo, captacion):
    datos = alta(captacion)
    a = acceso(anonimo, '12345678', 'incorrecta')
    b = acceso(anonimo, '99999999', 'incorrecta')
    assert a.status_code == b.status_code == 401
    assert a.json()['message'] == b.json()['message'] and codigo(a) == codigo(b) == 'CREDENCIALES_INVALIDAS'
    assert datos['credencial']['usuario'] == '12345678'


def test_cinco_fallos_bloquean_con_429_y_la_clave_correcta_tampoco_entra(anonimo, captacion):
    datos = alta(captacion)
    for _ in range(4):
        assert acceso(anonimo, '12345678', 'mala').status_code == 401
    r = acceso(anonimo, '12345678', 'mala')
    assert r.status_code == 429 and codigo(r) == 'CREDENCIAL_BLOQUEADA' and r.json()['data']['bloqueada_hasta']
    r = acceso(anonimo, '12345678', datos['credencial']['clave_temporal'])
    assert r.status_code == 429


def test_acceso_con_throttle_por_ip(anonimo, monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {**ScopedRateThrottle.THROTTLE_RATES, 'login': '3/min'})
    estados = [acceso(anonimo, f'9999999{n}', 'x').status_code for n in range(5)]
    assert estados == [401, 401, 401, 429, 429]


def test_acceso_con_ventana_vencida_dice_que_vencio(anonimo, captacion):
    datos = alta(captacion)
    pasado = timezone.now() - timedelta(minutes=1)
    CredencialPostulanteModel.objects.update(vence_el=pasado)
    ExpedientePostulacionModel.objects.update(ventana_vence_el=pasado)
    r = acceso(anonimo, '12345678', datos['credencial']['clave_temporal'])
    assert r.status_code == 403 and codigo(r) == 'CREDENCIAL_VENCIDA' and 'venció' in r.json()['message']


def test_acceso_con_cuerpo_incompleto_es_400(anonimo):
    assert anonimo.post(f'{BASE}/acceso/', {'cedula': '12345678'}, format='json').status_code == 400


# ---------------------------------------------------------------- cambio de clave obligatorio
def test_mientras_debe_cambiar_la_clave_el_resto_responde_403_con_codigo(anonimo, captacion):
    cliente, datos, token = invitado(anonimo, captacion, cambiar=False)
    for metodo, ruta in (('get', 'mi-expediente'), ('put', 'borrador'), ('post', 'enviar')):
        r = getattr(cliente, metodo)(f'{BASE}/{ruta}/', {'nombres': 'A', 'apellidos': 'B'}, format='json')
        assert r.status_code == 403 and codigo(r) == 'CAMBIO_CLAVE_OBLIGATORIO', (ruta, r.content)


def test_cambiar_clave_valida_la_actual_y_la_politica_y_entrega_un_token_nuevo(anonimo, captacion):
    cliente, datos, token = invitado(anonimo, captacion, cambiar=False)
    temporal = datos['credencial']['clave_temporal']
    r = cliente.post(f'{BASE}/cambiar-clave/', {'clave_actual': 'no-es', 'clave_nueva': CLAVE_NUEVA}, format='json')
    assert r.status_code == 401 and codigo(r) == 'CREDENCIALES_INVALIDAS'
    r = cliente.post(f'{BASE}/cambiar-clave/', {'clave_actual': temporal, 'clave_nueva': 'corta'}, format='json')
    assert r.status_code == 400 and 'clave_nueva' in r.json()['data']['errores']
    r = cliente.post(f'{BASE}/cambiar-clave/', {'clave_actual': temporal, 'clave_nueva': CLAVE_NUEVA}, format='json')
    assert r.status_code == 200 and r.json()['data']['debe_cambiar_clave'] is False
    nuevo = r.json()['data']['token']
    assert nuevo != token
    assert cliente.get(f'{BASE}/mi-expediente/').status_code == 401  # el token anterior cayó
    ok_ = APIClient()
    ok_.credentials(HTTP_AUTHORIZATION=f'Bearer {nuevo}')
    assert ok_.get(f'{BASE}/mi-expediente/').status_code == 200
    assert acceso(anonimo, '12345678', temporal).status_code == 401
    assert acceso(anonimo, '12345678', CLAVE_NUEVA).status_code == 200


def test_cambiar_clave_sin_token_de_postulante_se_rechaza(anonimo, captacion):
    assert anonimo.post(f'{BASE}/cambiar-clave/', {'clave_actual': 'x', 'clave_nueva': 'y'}, format='json').status_code == 401


# ---------------------------------------------------------------- aislamiento de tokens
def _empleado_con_token():
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    emp, _ = EmployeeModel.objects.get_or_create(
        cedulaidentidad='20111234', defaults={'nombres': 'María', 'apellidos': 'Prueba', 'sexoid': sexo})
    cuenta = CuentaModel.objects.filter(cedula=emp).first() or CuentaModel.objects.create_user(
        cedula=emp, password='Clave*Segura1')
    from rest_framework_simplejwt.tokens import RefreshToken
    return str(RefreshToken.for_user(cuenta).access_token)


RUTAS_PERSONAL = ('/api/v1/carnetizacion/plantillas/', '/api/v1/fe-de-vida/procesos/', '/api/v1/identidad/auth/me/')


@pytest.mark.parametrize('ruta', RUTAS_PERSONAL)
def test_el_token_de_postulante_no_sirve_en_vistas_de_personal(anonimo, captacion, ruta):
    _, _, token = invitado(anonimo, captacion)
    por_header = APIClient()
    por_header.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    assert por_header.get(ruta).status_code == 401
    por_cookie = APIClient()
    por_cookie.cookies['dj_access'] = token
    assert por_cookie.get(ruta).status_code == 401


def test_la_sesion_de_postulante_no_pasa_ningun_has_permission_aunque_se_fuerce(captacion):
    forzado = APIClient()
    forzado.force_authenticate(user=SesionPostulante('12345678', 'x', False, 1))
    assert forzado.post(f'{BASE}/postulantes/', {'cedula': '12345678', 'nombres': 'A', 'apellidos': 'B'},
                        format='json').status_code == 403
    assert forzado.get('/api/v1/fe-de-vida/procesos/').status_code == 403


def test_el_token_de_empleado_no_sirve_en_las_rutas_del_postulante(anonimo):
    token = _empleado_con_token()
    con_header = APIClient()
    con_header.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    con_cookie = APIClient()
    con_cookie.cookies['dj_access'] = token
    for cliente in (con_header, con_cookie):
        for ruta in ('mi-expediente', 'borrador', 'enviar'):
            r = cliente.get(f'{BASE}/{ruta}/') if ruta == 'mi-expediente' else cliente.post(f'{BASE}/{ruta}/')
            assert r.status_code in (401, 403) and r.status_code != 200, ruta
    assert con_header.get(f'{BASE}/mi-expediente/').status_code == 401
    assert con_cookie.get(f'{BASE}/mi-expediente/').status_code == 401


def test_un_empleado_autenticado_con_todos_los_permisos_no_entra_a_mi_expediente():
    todos = APIClient()
    todos.force_authenticate(user=Personal(permisos=('postulacion.crear_postulante', 'postulacion.verificar')))
    assert todos.get(f'{BASE}/mi-expediente/').status_code == 403
    assert todos.put(f'{BASE}/borrador/', {'nombres': 'A', 'apellidos': 'B'}, format='json').status_code == 403
    assert todos.post(f'{BASE}/enviar/').status_code == 403


def test_sin_token_o_con_token_manipulado_es_401(anonimo, captacion):
    _, datos, token = invitado(anonimo, captacion)
    assert anonimo.get(f'{BASE}/mi-expediente/').status_code == 401
    for malo in (token[:-3] + 'abc', token + 'x', 'basura', ''):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {malo}')
        assert c.get(f'{BASE}/mi-expediente/').status_code == 401, malo
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f'Basic {token}')
    assert c.get(f'{BASE}/mi-expediente/').status_code == 401


def test_un_token_vencido_no_sirve(anonimo, captacion):
    _, datos, _ = invitado(anonimo, captacion)
    cred = CredencialPostulanteModel.objects.get()
    ahora = timezone.now()
    viejo = emitir_token_invitado(cedula='12345678', expediente_id=datos['expediente']['id'],
                                  version_sesion=cred.version_sesion, ahora=ahora - timedelta(hours=3),
                                  expira_el=ahora - timedelta(hours=1))
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {viejo}')
    assert c.get(f'{BASE}/mi-expediente/').status_code == 401


def test_la_credencial_vencida_corta_la_sesion_en_la_siguiente_llamada(anonimo, captacion):
    cliente, _, _ = invitado(anonimo, captacion)
    assert cliente.get(f'{BASE}/mi-expediente/').status_code == 200
    CredencialPostulanteModel.objects.update(vence_el=timezone.now() - timedelta(seconds=1))
    r = cliente.get(f'{BASE}/mi-expediente/')
    assert r.status_code == 403 and codigo(r) == 'CREDENCIAL_VENCIDA'


# ---------------------------------------------------------------- Zero-IDOR
def test_mi_expediente_siempre_es_el_de_la_sesion_y_no_hay_forma_de_ver_otro(anonimo, captacion):
    cliente_a, datos_a, _ = invitado(anonimo, captacion, '11111111')
    _, datos_b, _ = invitado(APIClient(), captacion, '22222222')
    r = cliente_a.get(f'{BASE}/mi-expediente/', {'expediente_id': datos_b['expediente']['id'], 'cedula': '22222222'})
    d = r.json()['data']
    assert r.status_code == 200 and d['postulante']['cedula'] == '11111111'
    assert d['expediente']['id'] == datos_a['expediente']['id']
    # No existe ruta con id en la URL del postulante.
    assert cliente_a.get(f"{BASE}/mi-expediente/{datos_b['expediente']['id']}/").status_code == 404


def test_un_token_con_la_cedula_de_uno_y_el_expediente_de_otro_se_rechaza(anonimo, captacion):
    _, datos_a, _ = invitado(anonimo, captacion, '11111111')
    _, datos_b, _ = invitado(APIClient(), captacion, '22222222')
    ahora = timezone.now()
    cred_b = CredencialPostulanteModel.objects.get(usuario='22222222')
    cruzado = emitir_token_invitado(cedula='11111111', expediente_id=datos_b['expediente']['id'],
                                    version_sesion=cred_b.version_sesion, ahora=ahora, expira_el=ahora + timedelta(hours=1))
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {cruzado}')
    assert c.get(f'{BASE}/mi-expediente/').status_code == 401


def test_el_borrador_ignora_cualquier_id_o_cedula_del_cuerpo(anonimo, captacion):
    cliente_a, datos_a, _ = invitado(anonimo, captacion, '11111111')
    _, datos_b, _ = invitado(APIClient(), captacion, '22222222')
    r = cliente_a.put(f'{BASE}/borrador/', {
        'nombres': 'Soy', 'apellidos': 'Intruso', 'cedula': '22222222', 'expediente_id': datos_b['expediente']['id'],
        'postulante_id': datos_b['postulante']['id']}, format='json')
    assert r.status_code == 200
    assert PostulanteModel.objects.get(cedula='11111111').nombres == 'Soy'
    assert PostulanteModel.objects.get(cedula='22222222').nombres == 'Ana María'


# ---------------------------------------------------------------- borrador
def test_borrador_guarda_datos_basicos_y_el_formulario_sin_historial_extra(anonimo, captacion):
    cliente, datos, _ = invitado(anonimo, captacion)
    antes = TransicionExpedienteModel.objects.filter(expediente_id=datos['expediente']['id']).count()
    r = cliente.put(f'{BASE}/borrador/', {
        'nombres': 'Ana  María', 'apellidos': 'Pérez Gil', 'correo': 'ana@example.com', 'telefono_movil': '0414-7654321',
        'datos_ventana1': {**DATOS_OK, 'estado_civil': 'Soltera'}}, format='json')
    assert r.status_code == 200, r.content
    d = r.json()['data']
    assert d['postulante'] == {'cedula': '12345678', 'nombres': 'Ana María', 'apellidos': 'Pérez Gil',
                               'correo': 'ana@example.com', 'telefono_movil': '+584147654321'}
    assert d['datos_ventana1']['sexo'] == 'F' and d['campos_pendientes'] == []
    assert ExpedientePostulacionModel.objects.get(pk=datos['expediente']['id']).datos_ventana1['estado_civil'] == 'Soltera'
    assert TransicionExpedienteModel.objects.filter(expediente_id=datos['expediente']['id']).count() == antes
    # Omitir datos_ventana1 no los borra.
    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'Pérez'}, format='json')
    assert r.json()['data']['datos_ventana1']['sexo'] == 'F'


def test_borrador_rechaza_datos_invalidos_con_el_campo(anonimo, captacion):
    cliente, _, _ = invitado(anonimo, captacion)
    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'P', 'datos_ventana1': {'sexo': 'X'}}, format='json')
    assert r.status_code == 400 and 'datos_ventana1.sexo' in r.json()['data']['errores']
    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'P', 'datos_ventana1': {'cedula': '1'}}, format='json')
    assert r.status_code == 400
    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana 123', 'apellidos': 'P'}, format='json')
    assert r.status_code == 400
    assert cliente.put(f'{BASE}/borrador/', {'apellidos': 'P'}, format='json').status_code == 400


def test_mi_expediente_muestra_estado_ventana_vencimiento_y_pendientes(anonimo, captacion):
    cliente, datos, _ = invitado(anonimo, captacion)
    d = cliente.get(f'{BASE}/mi-expediente/').json()['data']
    e = d['expediente']
    assert (e['estado'], e['ventana'], e['numero']) == ('EN_CAPTURA', 1, datos['expediente']['numero'])
    assert e['vence_el'] and e['ultima_observacion'] is None and d['campos_pendientes'] == ['fecha_nacimiento', 'sexo']


# ---------------------------------------------------------------- envío y devolución
def test_enviar_exige_los_datos_obligatorios_aplica_la_transicion_y_cierra_la_sesion(anonimo, captacion):
    cliente, datos, token = invitado(anonimo, captacion)
    r = cliente.post(f'{BASE}/enviar/')
    assert r.status_code == 400 and 'fecha_nacimiento' in r.json()['message']
    cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'Pérez', 'datos_ventana1': DATOS_OK}, format='json')
    r = cliente.post(f'{BASE}/enviar/')
    assert r.status_code == 200 and r.json()['data']['sesion_cerrada'] is True
    assert r.json()['data']['expediente']['estado'] == 'ENVIADO_CAPTACION'
    historial = list(TransicionExpedienteModel.objects.filter(expediente_id=datos['expediente']['id'])
                     .values_list('estado_destino', 'actor_tipo'))
    assert historial[-1] == ('ENVIADO_CAPTACION', 'POSTULANTE')
    # La sesión se revocó y la clave ya no abre el expediente mientras Captación lo revisa.
    assert cliente.get(f'{BASE}/mi-expediente/').status_code == 401
    r = acceso(anonimo, '12345678', CLAVE_NUEVA)
    assert r.status_code == 403 and codigo(r) == 'ACCESO_NO_DISPONIBLE'
    assert AuditoriaLog.objects.filter(accion='POSTULANTE_ENVIO').count() == 1


def test_devolucion_de_captacion_reabre_la_ventana_y_el_postulante_corrige_y_reenvia(anonimo, captacion):
    cliente, datos, _ = invitado(anonimo, captacion)
    cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'Pérez', 'datos_ventana1': DATOS_OK}, format='json')
    cliente.post(f'{BASE}/enviar/')
    analista = Actor(cedula='20000001', permisos=frozenset({'postulacion.verificar'}))
    from core.infrastructure.providers import obtener_lector_configuracion
    aplicar_transicion_expediente(
        RepoPostulacionORM(), obtener_lector_configuracion(), expediente_id=datos['expediente']['id'],
        destino=E.EN_CORRECCION_DATOS, actor=analista, motivo='Falta el segundo apellido',
        ahora=timezone.now() + timedelta(days=30),
    )
    fila = CredencialPostulanteModel.objects.get()
    assert fila.vence_el > timezone.now() + timedelta(days=30)  # vigencia extendida por la devolución
    # Entra de nuevo (la fecha del vencimiento ya es futura respecto de `ahora`).
    r = acceso(anonimo, '12345678', CLAVE_NUEVA)
    assert r.status_code == 200, r.content
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['data']['token']}")
    d = c.get(f'{BASE}/mi-expediente/').json()['data']
    assert d['expediente']['estado'] == 'EN_CORRECCION_DATOS'
    assert d['expediente']['ultima_observacion']['motivo'] == 'Falta el segundo apellido'
    r = c.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'Pérez Gil'}, format='json')
    assert r.status_code == 200 and PostulanteModel.objects.get().apellidos == 'Pérez Gil'
    r = c.post(f'{BASE}/enviar/')
    assert r.status_code == 200 and r.json()['data']['expediente']['estado'] == 'ENVIADO_CAPTACION'


def test_ventana_2_envia_a_revision_final_y_solo_admite_datos_basicos(anonimo, captacion):
    cliente, datos, _ = invitado(anonimo, captacion)
    ahora = timezone.now()
    ExpedientePostulacionModel.objects.update(estado='CONSOLIDANDO', ventana=2, ventana_vence_el=ahora + timedelta(days=5))
    CredencialPostulanteModel.objects.update(ventana=2, vence_el=ahora + timedelta(days=5))
    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'Pérez', 'datos_ventana1': DATOS_OK}, format='json')
    assert r.status_code == 400
    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana', 'apellidos': 'Pérez'}, format='json')
    assert r.status_code == 200 and r.json()['data']['expediente']['ventana'] == 2
    r = cliente.post(f'{BASE}/enviar/')
    assert r.status_code == 200 and r.json()['data']['expediente']['estado'] == 'EN_REVISION_FINAL'
    assert TransicionExpedienteModel.objects.filter(
        expediente_id=datos['expediente']['id']).order_by('fecha', 'created_at').last().estado_destino == 'EN_REVISION_FINAL'


def test_enviar_y_borrador_con_la_ventana_vencida_se_rechazan(anonimo, captacion):
    cliente, datos, _ = invitado(anonimo, captacion)
    pasado = timezone.now() - timedelta(seconds=5)
    ExpedientePostulacionModel.objects.update(ventana_vence_el=pasado)
    CredencialPostulanteModel.objects.update(vence_el=pasado)
    assert cliente.put(f'{BASE}/borrador/', {'nombres': 'A', 'apellidos': 'B'}, format='json').status_code == 403
    assert cliente.post(f'{BASE}/enviar/').status_code == 403


def test_un_borrador_sin_correo_ni_telefono_conserva_los_que_registro_captacion(anonimo, captacion):
    """Omitir correo/teléfono en el borrador no los borra (si no, el postulante deja de recibir avisos por correo);
    enviarlos vacíos sí los limpia a propósito."""
    from apps.postulacion.infrastructure.models.expediente_models import PostulanteModel

    datos = alta(captacion, '15999001', correo='ana@ejemplo.invalid', telefono_movil='04141234567')
    r = acceso(anonimo, '15999001', datos['credencial']['clave_temporal'])
    token = r.json()['data']['token']
    r = anonimo.post(f'{BASE}/cambiar-clave/', {
        'clave_actual': datos['credencial']['clave_temporal'], 'clave_nueva': CLAVE_NUEVA},
        format='json', HTTP_AUTHORIZATION=f'Bearer {token}')
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['data']['token']}")

    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana María', 'apellidos': 'Pérez'}, format='json')
    assert r.status_code == 200, r.content
    p = PostulanteModel.objects.get(cedula='15999001')
    assert p.correo == 'ana@ejemplo.invalid' and p.telefono_movil

    r = cliente.put(f'{BASE}/borrador/', {'nombres': 'Ana María', 'apellidos': 'Pérez', 'correo': ''}, format='json')
    assert r.status_code == 200, r.content
    assert PostulanteModel.objects.get(cedula='15999001').correo == ''
