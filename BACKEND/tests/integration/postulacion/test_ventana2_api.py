"""Ventana 2 del postulante (G-2) por la API, contra la BD: catálogos, borrador, foto, Zero-IDOR y envío."""
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, TransicionExpedienteModel
from tests.integration.postulacion._presupuesto_mundo import BASE, Almacen, Notificador, datos
from tests.integration.postulacion._ventana2_mundo import (
    CLAVE_NUEVA,
    Mundo2,
    datos_v2,
    foto,
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
def post(m2):
    """Postulante autenticado en la Ventana 2 (alta, reapertura, acceso y cambio de clave por la API)."""
    cliente, exp = postulante_en_ventana2(m2)
    return cliente, exp


def codigo_de(r):
    return (r.json().get('data') or {}).get('codigo')


# ------------------------------------------------------------------------------------------------ catálogos
def test_catalogos_traen_los_mismos_catalogos_del_expediente_y_la_cascada_geografica(m2, post):
    c, _ = post
    d = datos(c.get(f'{BASE}/ventana2/catalogos/'))
    assert {p['nombre'] for p in d['parentescos']} == {'HIJO(A)', 'CONYUGE'}   # AMIGO no aplica a familiares
    hijo = next(p for p in d['parentescos'] if p['nombre'] == 'HIJO(A)')
    assert hijo['es_hijo'] and hijo['permite_orden_hijo'] and hijo['sin_cedula_hasta_edad'] == 9
    assert {s['nombre'] for s in d['sexos']} == {'F', 'M'}
    assert d['condiciones_vivienda'][0]['nombre'] == 'PROPIA' and d['grupos_sanguineos'][0]['nombre'] == 'O+'
    assert d['alergias'][0]['nombre'] == 'POLEN' and d['patologias_cronicas'][0]['nombre'] == 'ASMA'
    assert d['discapacidades'][0]['nombre'] == 'AUDITIVA'
    assert [t['valor'] for t in d['tallas']['camisa']] == ['M'] and [t['valor'] for t in d['tallas']['calzado']] == ['40']
    assert {e['nombre'] for e in d['estados']} == {'MIRANDA', 'ZULIA'} and d['municipios'] == [] and d['parroquias'] == []
    d = datos(c.get(f'{BASE}/ventana2/catalogos/', {'estado_id': m2.cat['estado'].pk, 'municipio_id': m2.cat['municipio'].pk}))
    assert [m['nombre'] for m in d['municipios']] == ['BARUTA'] and [p['nombre'] for p in d['parroquias']] == ['NUESTRA SENORA DEL ROSARIO']


def test_catalogos_exigen_la_sesion_del_postulante(m2, post):
    assert APIClient().get(f'{BASE}/ventana2/catalogos/').status_code in (401, 403)
    assert m2.captacion().get(f'{BASE}/ventana2/catalogos/').status_code == 403   # un empleado NO es un postulante


def test_un_empleado_aunque_tenga_todos_los_permisos_no_entra_a_las_rutas_del_postulante(m2, post):
    empleado, anonimo = m2.captacion(), APIClient()
    for cliente in (empleado, anonimo):
        for r in (cliente.get(f'{BASE}/ventana2/'), cliente.put(f'{BASE}/ventana2/', {}, format='json'),
                  cliente.get(f'{BASE}/ventana2/catalogos/'), cliente.get(f'{BASE}/ventana2/foto/'),
                  cliente.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart')):
            assert r.status_code in (401, 403), r.content


# ------------------------------------------------------------------------------------------------ borrador
def test_borrador_vacio_lista_todo_lo_que_falta_incluida_la_foto(post):
    c, exp = post
    d = datos(c.get(f'{BASE}/ventana2/'))
    assert d['expediente']['estado'] == 'CONSOLIDANDO' and d['expediente']['ventana'] == 2
    assert d['datos_ventana2'] == {} and d['completa'] is False and d['foto'] == {'tiene': False, 'subida_el': None, 'tamano': 0}
    campos = {f['campo'] for f in d['faltantes']}
    assert {'familiares', 'vivienda.condicion_vivienda_id', 'vivienda.direccion_exacta', 'salud.grupo_sanguineo_id',
            'tallas.talla_camisa_id', 'tallas.talla_zapatos_id', 'foto'} <= campos


def test_guardar_borrador_reemplaza_la_seccion_enviada_y_conserva_las_omitidas(m2, post):
    c, exp = post
    completo = datos_v2(m2.cat)
    r = c.put(f'{BASE}/ventana2/', completo, format='json')
    assert r.status_code == 200, r.content
    guardado = datos(r)['datos_ventana2']
    assert guardado['familiares'][1]['segundo_nombre'] == 'Ana' and guardado['vivienda']['ciudad_region'] == 'Caracas'
    assert ExpedientePostulacionModel.objects.get(pk=exp).datos_ventana2 == guardado
    # solo la vivienda: reemplaza esa sección y no toca las demás
    r = c.put(f'{BASE}/ventana2/', {'vivienda': {'condicion_vivienda_id': m2.cat['condicion'].pk, 'direccion_exacta': 'Otra calle'}}, format='json')
    assert r.status_code == 200, r.content
    d = datos(r)['datos_ventana2']
    assert d['vivienda'] == {'condicion_vivienda_id': m2.cat['condicion'].pk, 'direccion_exacta': 'Otra calle'}
    assert d['familiares'] == guardado['familiares'] and d['tallas'] == guardado['tallas']
    assert 'vivienda.estado_id' in {f['campo'] for f in datos(r)['faltantes']}
    # guardar un borrador no deja asiento en el historial ni cambia el estado
    assert TransicionExpedienteModel.objects.filter(expediente_id=exp, estado_destino='CONSOLIDANDO').count() == 1
    assert datos(c.get(f'{BASE}/mi-expediente/'))['expediente']['estado'] == 'CONSOLIDANDO'


@pytest.mark.parametrize('cuerpo, esperado', [
    ({'otra_cosa': 1}, 'datos_ventana2'),
    ({'vivienda': {'color': 'azul'}}, 'datos_ventana2.vivienda'),
    ({'familiares': 'no es lista'}, 'datos_ventana2.familiares'),
    ({'familiares': [{'primer_nombre': 'A', 'fecha_nacimiento': '2999-01-01'}]}, 'datos_ventana2.familiares.0.fecha_nacimiento'),
    ({'familiares': [{'primer_nombre': 'A', 'fecha_nacimiento': 'ayer'}]}, 'datos_ventana2.familiares.0.fecha_nacimiento'),
    ({'familiares': [{'depende_economicamente': 'si'}]}, 'datos_ventana2.familiares.0.depende_economicamente'),
    ({'familiares': [{'orden_hijo': 150}]}, 'datos_ventana2.familiares.0.orden_hijo'),
    ({'salud': {'alergias': 'polen'}}, 'datos_ventana2.salud.alergias'),
    ({'tallas': {'talla_camisa_id': 'XL'}}, 'datos_ventana2.tallas.talla_camisa_id'),
    ({'vivienda': {'direccion_exacta': 'x' * 301}}, 'datos_ventana2.vivienda.direccion_exacta'),
])
def test_borrador_rechaza_claves_y_valores_que_no_son_del_esquema(post, cuerpo, esperado):
    c, _ = post
    r = c.put(f'{BASE}/ventana2/', cuerpo, format='json')
    assert r.status_code == 400, r.content
    assert esperado in str(r.json())


def test_borrador_rechaza_ids_que_no_existen_o_no_encajan_con_los_catalogos(m2, post):
    c, exp = post
    cat = m2.cat
    r = c.put(f'{BASE}/ventana2/', {
        'vivienda': {'condicion_vivienda_id': 999999, 'estado_id': cat['estado'].pk, 'municipio_id': cat['municipio_zulia'].pk,
                     'parroquia_id': cat['parroquia'].pk, 'direccion_exacta': 'x'},
        'tallas': {'talla_camisa_id': cat['tallas']['ZAPATOS'].pk},
        'salud': {'grupo_sanguineo_id': 999999, 'alergias': [999999]},
        'familiares': [{'parentesco_id': cat['no_familiar'].pk, 'sexo_id': 999999}],
    }, format='json')
    assert r.status_code == 400 and codigo_de(r) == 'DATOS_INVALIDOS', r.content
    errores = r.json()['data']['errores']
    assert errores['vivienda.condicion_vivienda_id'] and errores['vivienda.municipio_id']      # inexistente / de otro estado
    assert errores['vivienda.parroquia_id']                                                    # no es de ese municipio
    assert 'calzado' in errores['tallas.talla_camisa_id'] or 'camisa' in errores['tallas.talla_camisa_id']
    assert errores['salud.grupo_sanguineo_id'] and errores['salud.alergias']
    assert errores['familiares.0.parentesco_id'] and errores['familiares.0.sexo_id']
    assert ExpedientePostulacionModel.objects.get(pk=exp).datos_ventana2 == {}   # nada se guardó


# ------------------------------------------------------------------------------------------------ estado y ventana
def test_la_ventana_2_no_sirve_con_el_expediente_en_otro_estado(m2, post):
    c, exp = post
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='EN_CORRECCION_DATOS', ventana=1)
    for r in (c.get(f'{BASE}/ventana2/'), c.put(f'{BASE}/ventana2/', {}, format='json'),
              c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart'), c.get(f'{BASE}/ventana2/foto/')):
        assert r.status_code == 409 and codigo_de(r) == 'VENTANA_INCORRECTA'
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='EN_REVISION_FINAL', ventana=2)
    r = c.get(f'{BASE}/ventana2/')   # en revisión no hay acceso: la sesión misma deja de valer
    assert r.status_code == 403 and codigo_de(r) == 'ACCESO_NO_DISPONIBLE'


def test_con_la_ventana_vencida_nada_funciona(post):
    c, exp = post
    pasado = timezone.now() - timedelta(seconds=5)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=pasado)
    CredencialPostulanteModel.objects.filter(expediente_id=exp).update(vence_el=pasado)
    for r in (c.get(f'{BASE}/ventana2/'), c.put(f'{BASE}/ventana2/', {}, format='json'),
              c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart'), c.post(f'{BASE}/enviar/')):
        assert r.status_code == 403 and codigo_de(r) == 'CREDENCIAL_VENCIDA'


# ------------------------------------------------------------------------------------------------ Zero-IDOR
def test_cada_postulante_solo_ve_y_toca_lo_suyo(m2, post):
    a, exp_a = post
    b, exp_b = postulante_en_ventana2(m2, cedula='87654321')
    assert a.put(f'{BASE}/ventana2/', datos_v2(m2.cat), format='json').status_code == 200
    assert a.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart').status_code == 200
    # b no ve nada de a: su Ventana 2 sigue vacía y su foto no existe
    assert datos(b.get(f'{BASE}/ventana2/'))['datos_ventana2'] == {} and b.get(f'{BASE}/ventana2/foto/').status_code == 404
    assert ExpedientePostulacionModel.objects.get(pk=exp_b).foto_clave == ''
    # no hay forma de apuntar al expediente ajeno: ninguna ruta del postulante recibe un id, y el cuerpo no cuenta
    r = b.put(f'{BASE}/ventana2/', {'expediente_id': exp_a, **datos_v2(m2.cat)}, format='json')
    assert r.status_code == 400
    assert ExpedientePostulacionModel.objects.get(pk=exp_a).datos_ventana2['vivienda']['ciudad_region'] == 'Caracas'
    assert b.get(f'{BASE}/ventana2/{exp_a}/').status_code == 404
    # un postulante no entra a las rutas de Captación
    assert b.get(f'{BASE}/expedientes/{exp_a}/foto/').status_code in (401, 403)
    assert b.get(f'{BASE}/expedientes/{exp_a}/').status_code in (401, 403)


# ------------------------------------------------------------------------------------------------ foto
def test_foto_valida_jpeg_y_png_se_guarda_con_clave_opaca_sin_la_cedula(post, django_capture_on_commit_callbacks):
    c, exp = post
    r = c.post(f'{BASE}/ventana2/foto/', {'foto': foto(600, 600)}, format='multipart')
    assert r.status_code == 200, r.content
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.foto_clave.startswith('postulacion/foto/') and e.foto_clave.endswith('.jpg') and '12345678' not in e.foto_clave
    assert e.foto_tamano == len(Almacen.objetos[e.foto_clave]) and len(e.foto_sha256) == 64 and e.foto_subida_el
    assert datos(r)['foto']['tiene'] is True and 'foto' not in {f['campo'] for f in datos(r)['faltantes']}
    # PNG (sin transparencia) también vale; reemplaza a la anterior y el objeto viejo se borra del almacén
    anterior = e.foto_clave
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post(f'{BASE}/ventana2/foto/', {'foto': foto(500, 500, 'PNG')}, format='multipart')
    assert r.status_code == 200, r.content
    nueva = ExpedientePostulacionModel.objects.get(pk=exp).foto_clave
    assert nueva != anterior and anterior not in Almacen.objetos and nueva in Almacen.objetos
    assert len([k for k in Almacen.objetos if k.startswith('postulacion/foto/')]) == 1


def test_foto_se_descarga_solo_la_propia_y_sin_cache(post):
    c, _ = post
    assert c.get(f'{BASE}/ventana2/foto/').status_code == 404
    c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart')
    r = c.get(f'{BASE}/ventana2/foto/')
    assert r.status_code == 200 and r['Cache-Control'] == 'private, no-store' and r['Content-Type'] == 'image/jpeg'
    assert r['X-Content-Type-Options'] == 'nosniff'


@pytest.mark.parametrize('archivo, motivo', [
    (lambda: SimpleUploadedFile('foto.jpg', b'esto no es una imagen'), 'firma falsa (texto con extensión .jpg)'),
    (lambda: SimpleUploadedFile('foto.jpg', b'%PDF-1.4 falso'), 'un PDF disfrazado de .jpg'),
    (lambda: SimpleUploadedFile('foto.png', foto(400, 400).read()), 'JPEG con extensión .png'),
    (lambda: SimpleUploadedFile('foto.gif', b'GIF89a\x01\x00\x01\x00'), 'tipo no permitido (.gif)'),
    (lambda: SimpleUploadedFile('foto.webp', b'RIFF....WEBPVP8 '), 'tipo no permitido (.webp)'),
    (lambda: SimpleUploadedFile('foto.pdf', b'%PDF-1.4'), 'tipo no permitido (.pdf)'),
    (lambda: foto(100, 100), 'demasiado pequeña'),
    (lambda: foto(2000, 400), 'tira extrema'),
    (lambda: SimpleUploadedFile('foto.jpg', b'\xff\xd8\xff' + b'\x00' * (5 * 1024 * 1024 + 1)), 'más de 5 MB'),
    (lambda: SimpleUploadedFile('foto.jpg', b'\xff\xd8\xffbasura'), 'firma JPEG pero contenido ilegible'),
])
def test_foto_invalida_se_rechaza_y_no_toca_nada(post, archivo, motivo):
    c, exp = post
    r = c.post(f'{BASE}/ventana2/foto/', {'foto': archivo()}, format='multipart')
    assert r.status_code == 400, (motivo, r.content)
    assert ExpedientePostulacionModel.objects.get(pk=exp).foto_clave == '' and Almacen.objetos == {}


def test_foto_sin_archivo_es_400(post):
    c, _ = post
    assert c.post(f'{BASE}/ventana2/foto/', {}, format='multipart').status_code == 400


def test_si_la_base_falla_al_guardar_la_foto_no_queda_el_objeto_huerfano(post, monkeypatch):
    c, _ = post
    from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM

    original = RepoPostulacionORM.guardar_expediente

    def falla(self, e):
        if e.foto_clave:
            raise RuntimeError('base caída')
        return original(self, e)

    monkeypatch.setattr(RepoPostulacionORM, 'guardar_expediente', falla)
    r = APIClient(raise_request_exception=False)
    r.credentials(HTTP_AUTHORIZATION=c._credentials['HTTP_AUTHORIZATION'])
    assert r.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart').status_code == 500
    assert Almacen.objetos == {}


# ------------------------------------------------------------------------------------------------ enviar
def test_enviar_incompleto_devuelve_los_faltantes_con_codigo(m2, post):
    c, exp = post
    r = c.post(f'{BASE}/enviar/')
    assert r.status_code == 400 and codigo_de(r) == 'VENTANA2_INCOMPLETA', r.content
    faltantes = r.json()['data']['faltantes']
    assert {'seccion', 'campo', 'mensaje'} <= set(faltantes[0]) and 'foto' in {f['campo'] for f in faltantes}
    # con todo menos la foto: solo falta la foto
    c.put(f'{BASE}/ventana2/', datos_v2(m2.cat), format='json')
    r = c.post(f'{BASE}/enviar/')
    assert codigo_de(r) == 'VENTANA2_INCOMPLETA' and [f['campo'] for f in r.json()['data']['faltantes']] == ['foto']
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'CONSOLIDANDO'


def test_enviar_valida_las_reglas_del_familiar_al_enviar(m2, post):
    c, _ = post
    malos = datos_v2(m2.cat)
    malos['familiares'][0]['cedula'] = '12345678'             # la misma cédula del titular: se avisa al guardar
    r = c.put(f'{BASE}/ventana2/', malos, format='json')
    assert r.status_code == 400 and 'titular' in r.json()['data']['errores']['familiares.0.cedula']
    malos = datos_v2(m2.cat)
    malos['familiares'][1].pop('orden_hijo')                  # hijo menor sin cédula y sin orden: el borrador lo admite...
    malos['familiares'][0]['fecha_nacimiento'] = f'{timezone.now().year - 10}-01-01'   # ...y un cónyuge menor de 18 también
    assert c.put(f'{BASE}/ventana2/', malos, format='json').status_code == 200
    c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart')
    r = c.post(f'{BASE}/enviar/')                             # ...pero no se puede ENVIAR así
    campos = {f['campo']: f['mensaje'] for f in r.json()['data']['faltantes']}
    assert codigo_de(r) == 'VENTANA2_INCOMPLETA'
    assert 'familiares.1.orden_hijo' in campos and '18' in campos['familiares.0.fecha_nacimiento']


def test_enviar_completo_pasa_a_revision_final_suspende_la_credencial_y_avisa(m2, post, django_capture_on_commit_callbacks):
    c, exp = post
    c.put(f'{BASE}/ventana2/', datos_v2(m2.cat), format='json')
    c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart')
    Notificador.emitidas.clear(), Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post(f'{BASE}/enviar/')
    assert r.status_code == 200, r.content
    assert datos(r)['sesion_cerrada'] is True and datos(r)['expediente']['estado'] == 'EN_REVISION_FINAL'
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'EN_REVISION_FINAL' and e.contacto_pendiente_desde is None
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).order_by('fecha', 'created_at').last()
    assert (asiento.estado_origen, asiento.estado_destino, asiento.actor_tipo) == ('CONSOLIDANDO', 'EN_REVISION_FINAL', 'POSTULANTE')
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_REVISION_FINAL' and aviso.permiso_destino == 'postulacion.ver_bandeja'
    # la sesión se cerró: el mismo token ya no sirve, y la credencial no entra mientras Captación revisa
    assert c.get(f'{BASE}/mi-expediente/').status_code == 401
    r = APIClient().post(f'{BASE}/acceso/', {'cedula': '12345678', 'password': CLAVE_NUEVA}, format='json')
    assert r.status_code == 403 and codigo_de(r) == 'ACCESO_NO_DISPONIBLE'
    assert CredencialPostulanteModel.objects.get(expediente_id=exp).revocada is False   # suspendida (como la V1)


def test_el_postulante_que_envia_cierra_el_aviso_de_contacto_pendiente(m2, post, django_capture_on_commit_callbacks):
    c, exp = post
    c.put(f'{BASE}/ventana2/', datos_v2(m2.cat), format='json')
    c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart')
    Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        assert c.post(f'{BASE}/enviar/').status_code == 200
    assert ('expediente_postulacion', exp, '12345678', 'CONTACTAR_POSTULANTE') in Notificador.resueltas


# ------------------------------------------------------------------------------------------------ mi expediente
def test_mi_expediente_indica_la_ventana_y_el_formulario_que_toca(m2, post):
    c, exp = post
    d = datos(c.get(f'{BASE}/mi-expediente/'))
    assert d['ventana_actual'] == 2 and d['formulario'] == 'ventana2' and d['expediente']['ventana'] == 2
    assert d['tiene_foto'] is False and d['datos_ventana2'] == {} and 'foto' in d['campos_pendientes']
    assert 'foto' in {f['campo'] for f in d['faltantes_ventana2']}
    c.put(f'{BASE}/ventana2/', datos_v2(m2.cat), format='json')
    c.post(f'{BASE}/ventana2/foto/', {'foto': foto()}, format='multipart')
    d = datos(c.get(f'{BASE}/mi-expediente/'))
    assert d['tiene_foto'] is True and d['campos_pendientes'] == [] and d['datos_ventana2']['salud']['grupo_sanguineo_id']


def test_mi_expediente_en_la_ventana_1_indica_ventana1(m2):
    captacion = m2.captacion()
    a = captacion.post(f'{BASE}/postulantes/', {'cedula': '11111111', 'nombres': 'Eva', 'apellidos': 'Rojas'}, format='json').json()['data']
    anon = APIClient()
    token = anon.post(f'{BASE}/acceso/', {'cedula': '11111111', 'password': a['credencial']['clave_temporal']}, format='json').json()['data']['token']
    r = anon.post(f'{BASE}/cambiar-clave/', {'clave_actual': a['credencial']['clave_temporal'], 'clave_nueva': CLAVE_NUEVA},
                  format='json', HTTP_AUTHORIZATION=f'Bearer {token}')
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['data']['token']}")
    d = datos(c.get(f'{BASE}/mi-expediente/'))
    assert d['ventana_actual'] == 1 and d['formulario'] == 'ventana1' and d['datos_ventana2'] == {}
