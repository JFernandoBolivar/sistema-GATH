"""Reapertura de la Ventana 2 (G-1), revisión final (G-3) y foto del expediente por la API de Captación, contra la BD."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.postulacion.application.use_cases.vencimientos import procesar_vencimientos
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import BASE, Almacen, Config, Notificador, crear_expediente, datos
from tests.integration.postulacion._ventana2_mundo import (
    CAPTACION,
    Mundo2,
    cliente_personal,
    completar_ventana2,
    instalar_dobles_g,
    postulante_en_ventana2,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def dobles(monkeypatch):
    instalar_dobles_g(monkeypatch)


@pytest.fixture
def m2(mundo):
    return Mundo2(mundo)


@pytest.fixture
def captacion(m2):
    return m2.captacion()


def codigo_de(r):
    return (r.json().get('data') or {}).get('codigo')


def transicion(c, exp, destino, motivo='', **extra):
    return c.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': destino, 'motivo': motivo, **extra}, format='json')


def aprobado(m2, cedula='12345678', correo='ana@ejemplo.invalid'):
    exp = crear_expediente(m2.mundo, cedula)
    PostulanteModel.objects.filter(cedula=cedula).update(correo=correo)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='APROBADO', reserva_vence_el=timezone.now() + timedelta(days=9))
    return exp


# ------------------------------------------------------------------------------------------------ G-1 · reapertura
def test_reabrir_la_ventana_2_devuelve_una_credencial_nueva_una_sola_vez(m2, captacion, django_capture_on_commit_callbacks):
    exp = aprobado(m2)
    # Ya había una credencial de la Ventana 1 (suspendida). Por la API ya no se repone fuera de una ventana abierta.
    from apps.postulacion.application.use_cases.credenciales import emitir_credencial
    from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
    from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=timezone.now() + timedelta(days=1))
    emitir_credencial(RepoPostulacionORM(), HasheadorDjango(), expediente_id=exp, emitida_por='20000001')
    version_antes = CredencialPostulanteModel.objects.get(expediente_id=exp).version_sesion
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion(captacion, exp, 'CONSOLIDANDO')
    assert r.status_code == 200, r.content
    cred = datos(r)['credencial']
    assert cred['usuario'] == '12345678' and cred['ventana'] == 2 and cred['debe_cambiar_clave'] is True and len(cred['clave_temporal']) >= 10
    d = datos(r)['expediente']
    assert d['estado'] == 'CONSOLIDANDO' and d['ventana'] == 2
    vence = ExpedientePostulacionModel.objects.get(pk=exp).ventana_vence_el
    assert abs((vence - timezone.now()).total_seconds() - 10 * 86400) < 120   # los días del parámetro (10 en el doble)
    fila = CredencialPostulanteModel.objects.get(expediente_id=exp)
    assert fila.ventana == 2 and fila.vence_el == vence and fila.debe_cambiar_clave and not fila.revocada
    assert fila.version_sesion > version_antes and cred['clave_temporal'] not in fila.clave_hash   # solo el hash
    # el detalle posterior NO vuelve a traer la contraseña
    assert 'credencial' not in datos(captacion.get(f'{BASE}/expedientes/{exp}/'))
    # entra con la nueva
    r = APIClient().post(f'{BASE}/acceso/', {'cedula': '12345678', 'password': cred['clave_temporal']}, format='json')
    assert r.status_code == 200 and r.json()['data']['debe_cambiar_clave'] is True
    assert AuditoriaLog.objects.filter(accion='CREDENCIAL_REPUESTA').exists()
    assert cred['clave_temporal'] not in str(list(AuditoriaLog.objects.values_list('estado_nuevo', flat=True)))


def test_reabrir_avisa_contactar_cierra_el_aviso_de_aprobacion_y_el_correo_nunca_lleva_la_contrasena(
    m2, captacion, django_capture_on_commit_callbacks,
):
    exp = aprobado(m2)
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion(captacion, exp, 'CONSOLIDANDO')
    clave = datos(r)['credencial']['clave_temporal']
    assert ('expediente_postulacion', exp, '20000001', 'INGRESO_APROBADO') in Notificador.resueltas
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'CONTACTAR_POSTULANTE' and aviso.permiso_destino == 'postulacion.ver_bandeja'
    assert aviso.enlace == f'/captacion/expedientes/{exp}' and 'Ana María Pérez' in aviso.mensaje and clave not in aviso.mensaje
    (correo,) = Notificador.correos
    assert correo.tipo == 'POSTULACION_VENTANA2' and correo.destinatario_correo == 'ana@ejemplo.invalid'
    assert clave not in f'{correo.asunto} {correo.titulo} {correo.mensaje} {correo.enlace}' and '12345678' not in correo.mensaje


def test_reabrir_deja_la_tarea_de_contacto_pendiente_con_su_antiguedad(m2, captacion):
    exp = aprobado(m2)
    assert datos(captacion.get(f'{BASE}/expedientes/{exp}/'))['expediente']['contacto_pendiente'] is False
    transicion(captacion, exp, 'CONSOLIDANDO')
    e = datos(captacion.get(f'{BASE}/expedientes/{exp}/'))['expediente']
    assert e['contacto_pendiente'] is True and e['contacto_pendiente_desde'] and e['contacto_atrasado'] is False


def test_la_bandeja_marca_contactos_pendientes_y_atrasados_y_los_ordena_primero(m2, captacion):
    otro = crear_expediente(m2.mundo, '10000001', estado='ENVIADO_CAPTACION')          # pendiente de Captación (prioridad normal)
    reciente = aprobado(m2, '10000002')
    transicion(captacion, reciente, 'CONSOLIDANDO')
    atrasado = aprobado(m2, '10000003')
    transicion(captacion, atrasado, 'CONSOLIDANDO')
    ExpedientePostulacionModel.objects.filter(pk=atrasado).update(contacto_pendiente_desde=timezone.now() - timedelta(hours=49))
    r = captacion.get(f'{BASE}/expedientes/')
    filas = datos(r)['resultados']
    assert [f['id'] for f in filas][0] == atrasado     # el atrasado sube por encima de todo, aun del pendiente de Captación
    por_id = {f['id']: f for f in filas}
    assert (por_id[atrasado]['contacto_pendiente'], por_id[atrasado]['contacto_atrasado']) == (True, True)
    assert (por_id[reciente]['contacto_pendiente'], por_id[reciente]['contacto_atrasado']) == (True, False)
    assert (por_id[otro]['contacto_pendiente'], por_id[otro]['contacto_atrasado']) == (False, False)
    assert por_id[atrasado]['contacto_pendiente_desde'] and por_id[otro]['contacto_pendiente_desde'] is None
    # pestaña «Por contactar»: solo los pendientes
    r = captacion.get(f'{BASE}/expedientes/', {'por_contactar': 'true'})
    assert {f['id'] for f in datos(r)['resultados']} == {reciente, atrasado} and datos(r)['resultados'][0]['id'] == atrasado
    assert {f['id'] for f in datos(captacion.get(f'{BASE}/expedientes/', {'por_contactar': 'false'}))['resultados']} == {otro, reciente, atrasado}


def test_el_limite_de_atraso_sale_del_parametro(m2, captacion, monkeypatch):
    exp = aprobado(m2)
    transicion(captacion, exp, 'CONSOLIDANDO')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(contacto_pendiente_desde=timezone.now() - timedelta(hours=30))
    assert datos(captacion.get(f'{BASE}/expedientes/'))['resultados'][0]['contacto_atrasado'] is False   # 48 h por defecto
    config = Config()
    config.valores['captacion.horas_escalamiento_contacto'] = 24
    monkeypatch.setattr('apps.postulacion.presentation.views.captacion_views.configuracion', lambda: config)
    assert datos(captacion.get(f'{BASE}/expedientes/'))['resultados'][0]['contacto_atrasado'] is True


# ------------------------------------------------------------------------------------------------ G-1 · contactado
def test_contactado_registra_el_historial_sin_cambiar_de_estado_y_resuelve_el_aviso(
    m2, captacion, django_capture_on_commit_callbacks,
):
    exp = aprobado(m2)
    transicion(captacion, exp, 'CONSOLIDANDO')
    Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = captacion.post(f'{BASE}/expedientes/{exp}/contactado/', {'nota': 'Se le llamó al 0414 y confirmó que ingresa mañana'}, format='json')
    assert r.status_code == 200, r.content
    e = datos(r)['expediente']
    assert e['estado'] == 'CONSOLIDANDO' and e['contacto_pendiente'] is False and e['contacto_pendiente_desde'] is None
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).order_by('fecha', 'created_at').last()
    assert (asiento.estado_origen, asiento.estado_destino, asiento.actor_cedula) == ('CONSOLIDANDO', 'CONSOLIDANDO', '20000001')
    assert asiento.datos_extra['tipo'] == 'CONTACTADO' and asiento.datos_extra['nota'].startswith('Se le llamó')
    assert asiento.motivo == ''    # la nota NO es una observación: el postulante no la ve
    assert ('expediente_postulacion', exp, '20000001', 'CONTACTAR_POSTULANTE') in Notificador.resueltas
    assert ('expediente_postulacion', exp, '20000001', 'CONTACTO_ATRASADO') in Notificador.resueltas
    assert AuditoriaLog.objects.get(accion='POSTULANTE_CONTACTADO').estado_nuevo['con_nota'] is True
    # ya no está pendiente: hacerlo de nuevo es 409
    r = captacion.post(f'{BASE}/expedientes/{exp}/contactado/', {}, format='json')
    assert r.status_code == 409 and codigo_de(r) == 'CONTACTO_NO_PENDIENTE'
    assert datos(captacion.get(f'{BASE}/expedientes/', {'por_contactar': 'true'}))['resultados'] == []


def test_contactado_la_nota_es_opcional_y_el_postulante_no_la_lee(m2, captacion):
    c, exp = postulante_en_ventana2(m2)
    assert captacion.post(f'{BASE}/expedientes/{exp}/contactado/', {}, format='json').status_code == 200
    assert datos(c.get(f'{BASE}/mi-expediente/'))['expediente']['ultima_observacion'] is None


def test_contactado_solo_si_hay_contacto_pendiente_y_con_permiso(m2, captacion):
    exp = aprobado(m2)
    assert captacion.post(f'{BASE}/expedientes/{exp}/contactado/', {}, format='json').status_code == 409   # aún APROBADO
    transicion(captacion, exp, 'CONSOLIDANDO')
    assert captacion.post(f'{BASE}/expedientes/{exp}/contactado/', {'nota': 'x' * 501}, format='json').status_code == 400
    assert APIClient().post(f'{BASE}/expedientes/{exp}/contactado/', {}, format='json').status_code in (401, 403)
    for permisos in (('postulacion.ver_bandeja',), ('postulacion.verificar',), ('postulacion.ver_solicitudes',)):
        assert cliente_personal(*permisos).post(f'{BASE}/expedientes/{exp}/contactado/', {}, format='json').status_code == 403
    assert captacion.post(f'{BASE}/expedientes/00000000-0000-4000-8000-000000000000/contactado/', {}, format='json').status_code == 404
    assert datos(captacion.get(f'{BASE}/expedientes/{exp}/'))['expediente']['contacto_pendiente'] is True


def test_el_escalamiento_avisa_una_sola_vez_los_contactos_atrasados(m2, captacion):
    exp = aprobado(m2)
    transicion(captacion, exp, 'CONSOLIDANDO')
    nuevo = aprobado(m2, '10000002')
    transicion(captacion, nuevo, 'CONSOLIDANDO')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(contacto_pendiente_desde=timezone.now() - timedelta(hours=50))
    Notificador.emitidas.clear()
    resumen = procesar_vencimientos(RepoPostulacionORM(), Config(), Notificador(), ahora=timezone.now())
    assert resumen.contactos_escalados == 1 and resumen.errores == 0
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'CONTACTO_ATRASADO' and aviso.permiso_destino == 'postulacion.ver_bandeja' and aviso.ref_id == exp
    assert aviso.clave and aviso.enlace == f'/captacion/expedientes/{exp}'
    # sin notificador no avisa, y una nueva reapertura (otra fecha de pendiente) es otra clave
    assert procesar_vencimientos(RepoPostulacionORM(), Config(), None, ahora=timezone.now()).contactos_escalados == 0


# ------------------------------------------------------------------------------------------------ G-3 · revisión final
def en_revision_final(m2, cedula='12345678'):
    exp = crear_expediente(m2.mundo, cedula)
    PostulanteModel.objects.filter(cedula=cedula).update(correo='ana@ejemplo.invalid')
    completar_ventana2(exp, m2.cat, estado='EN_REVISION_FINAL')
    return exp


def test_detalle_de_revision_final_trae_los_datos_legibles_y_la_foto(m2, captacion):
    exp = en_revision_final(m2)
    d = datos(captacion.get(f'{BASE}/expedientes/{exp}/'))
    assert d['datos_ventana2']['vivienda']['condicion_vivienda_id'] == m2.cat['condicion'].pk
    legible = d['datos_ventana2_legible']
    assert legible['vivienda']['condicion_vivienda']['nombre'] == 'PROPIA' and legible['vivienda']['estado']['nombre'] == 'MIRANDA'
    assert legible['vivienda']['municipio']['nombre'] == 'BARUTA' and legible['vivienda']['parroquia']['nombre']
    assert legible['salud']['grupo_sanguineo']['nombre'] == 'O+' and legible['salud']['alergias'][0]['nombre'] == 'POLEN'
    assert legible['salud']['patologias_cronicas'][0]['nombre'] == 'ASMA' and legible['salud']['discapacidades'] == []
    assert legible['tallas']['camisa']['valor'] == 'M' and legible['tallas']['calzado']['valor'] == '40' and legible['tallas']['chaqueta'] is None
    conyuge, hijo = legible['familiares']
    assert conyuge['parentesco']['nombre'] == 'CONYUGE' and conyuge['sexo']['nombre'] == 'M' and hijo['parentesco']['nombre'] == 'HIJO(A)'
    assert d['ventana2_faltantes'] == []
    assert d['foto'] == {'tiene': True, 'subida_el': d['foto']['subida_el'], 'tamano': 10, 'url': f'{BASE}/expedientes/{exp}/foto/'}
    assert {a['destino'] for a in d['acciones']} == {'CONSOLIDANDO', 'LISTO_PARA_ASIGNAR'}


def test_la_foto_del_expediente_se_sirve_con_permiso_y_sin_cache(m2, captacion):
    exp = en_revision_final(m2)
    Almacen.objetos['postulacion/foto/semilla.jpg'] = b'\xff\xd8\xff-foto'
    r = captacion.get(f'{BASE}/expedientes/{exp}/foto/')
    assert r.status_code == 200 and r['Cache-Control'] == 'private, no-store' and b''.join(r.streaming_content) == b'\xff\xd8\xff-foto'
    assert AuditoriaLog.objects.get(accion='FOTO_EXPEDIENTE_CONSULTADA').recurso_id == exp
    assert cliente_personal('postulacion.verificar').get(f'{BASE}/expedientes/{exp}/foto/').status_code == 403
    assert APIClient().get(f'{BASE}/expedientes/{exp}/foto/').status_code in (401, 403)
    sin_foto = crear_expediente(m2.mundo, '10000009')
    assert captacion.get(f'{BASE}/expedientes/{sin_foto}/foto/').status_code == 404


def test_observar_faltantes_exige_motivo_y_reabre_con_credencial_nueva_aviso_y_correo(
    m2, captacion, django_capture_on_commit_callbacks,
):
    c, exp = postulante_en_ventana2(m2)
    c.put(f'{BASE}/ventana2/', {'vivienda': {'condicion_vivienda_id': m2.cat['condicion'].pk, 'direccion_exacta': 'x'}}, format='json')
    completar_ventana2(exp, m2.cat)
    c.post(f'{BASE}/enviar/')
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'EN_REVISION_FINAL'
    assert transicion(captacion, exp, 'CONSOLIDANDO').status_code == 400
    assert codigo_de(transicion(captacion, exp, 'CONSOLIDANDO', '   ')) == 'MOTIVO_OBLIGATORIO'
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'EN_REVISION_FINAL'
    viejo = CredencialPostulanteModel.objects.get(expediente_id=exp)
    Notificador.emitidas.clear(), Notificador.resueltas.clear(), Notificador.correos.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion(captacion, exp, 'CONSOLIDANDO', 'Falta la foto: la actual no se ve el rostro')
    assert r.status_code == 200, r.content
    cred = datos(r)['credencial']
    assert cred['ventana'] == 2 and cred['debe_cambiar_clave'] and cred['clave_temporal']
    nueva = CredencialPostulanteModel.objects.get(expediente_id=exp)
    assert nueva.clave_hash != viejo.clave_hash and nueva.version_sesion > viejo.version_sesion and not nueva.revocada
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'CONSOLIDANDO' and e.ventana == 2 and e.contacto_pendiente_desde is not None
    assert e.datos_ventana2['vivienda'] and e.foto_clave   # lo ya cargado se conserva
    assert ('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_REVISION_FINAL') in Notificador.resueltas
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'CONTACTAR_POSTULANTE' and 'Falta la foto' in aviso.mensaje and cred['clave_temporal'] not in aviso.mensaje
    (correo,) = Notificador.correos
    assert correo.asunto == 'Tu expediente necesita completar datos' and correo.tipo == 'POSTULACION_FALTANTES'
    assert 'Falta la foto' in correo.mensaje and e.numero in correo.mensaje and correo.enlace == '/postulacion/acceso'
    assert cred['clave_temporal'] not in f'{correo.asunto} {correo.titulo} {correo.mensaje}' and '12345678' not in correo.mensaje
    # el postulante ve el motivo como observación y entra con la nueva clave
    r = APIClient().post(f'{BASE}/acceso/', {'cedula': '12345678', 'password': cred['clave_temporal']}, format='json')
    assert r.status_code == 200 and r.json()['data']['debe_cambiar_clave'] is True


def test_conforme_pasa_a_listo_para_asignar_y_resuelve_el_aviso(m2, captacion, django_capture_on_commit_callbacks):
    exp = en_revision_final(m2)
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion(captacion, exp, 'LISTO_PARA_ASIGNAR')
    assert r.status_code == 200 and datos(r)['expediente']['estado'] == 'LISTO_PARA_ASIGNAR' and 'credencial' not in datos(r)
    assert Notificador.resueltas == [('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_REVISION_FINAL')]
    assert Notificador.emitidas == [] and Notificador.correos == []


def test_la_revision_final_exige_el_permiso_exacto(m2, captacion):
    exp = en_revision_final(m2)
    for destino in ('CONSOLIDANDO', 'LISTO_PARA_ASIGNAR'):
        assert transicion(cliente_personal('postulacion.verificar', 'postulacion.ver_bandeja'), exp, destino, 'x').status_code == 403
    assert transicion(cliente_personal(*CAPTACION), exp, 'CONTRATADO').status_code == 409   # contratar es por `asignar/`
