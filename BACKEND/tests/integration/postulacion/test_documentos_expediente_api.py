"""Documentos digitales dentro del expediente (F-4, F-5, F-6): proveedor real, campos propios, planilla, firma por clic, envío, Captación y contratación."""
import hashlib
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.models.documentos_models import (
    DocumentoGeneradoModel,
    FirmaDocumentoModel,
    ValoresDocumentoModel,
)
from apps.postulacion.infrastructure.documentos_expediente_orm import SUJETO, ProveedorDatosExpedienteORM
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import BASE, Almacen, datos
from tests.integration.postulacion._ventana2_mundo import (
    Mundo2,
    cliente_personal,
    instalar_dobles_g,
    listo_para_asignar,
    postulante_en_ventana2,
)
from tests.unit.documentos._ayudas import definicion_formulario, texto_de

pytestmark = pytest.mark.django_db

DOC = '/api/v1/documentos'
CAMPOS = [
    {'clave': 'sueldo', 'etiqueta': 'Sueldo al que aspira', 'tipo': 'texto', 'obligatorio': True},
    {'clave': 'inicio', 'etiqueta': 'Fecha de inicio', 'tipo': 'fecha'},
    {'clave': 'traslado', 'etiqueta': 'Acepta traslados', 'tipo': 'si_no'},
    {'clave': 'turno', 'etiqueta': 'Turno', 'tipo': 'opcion', 'opciones': ['DIURNO', 'NOCTURNO']},
    {'clave': 'notas', 'etiqueta': 'Notas', 'tipo': 'texto_largo'},
]


class AlmacenCompartido(Almacen):
    """El almacén de las pruebas de postulación (misma memoria) con `descargar`, que usan documentos y la foto."""

    def descargar(self, clave):
        return self.objetos[clave]


@pytest.fixture(autouse=True)
def dobles(monkeypatch, settings):
    instalar_dobles_g(monkeypatch)
    settings.DOMINIO_CORREO_INSTITUCIONAL = '@conatel.gob.ve'
    monkeypatch.setattr(almacen_mod, 'obtener_almacen', lambda: AlmacenCompartido())
    for modulo in ('postulante_views', 'captacion_views'):
        monkeypatch.setattr(f'apps.postulacion.presentation.views.{modulo}.SeaweedFSStorage', AlmacenCompartido)


@pytest.fixture
def m2(mundo):
    return Mundo2(mundo)


@pytest.fixture
def admin_docs():
    return cliente_personal('documentos.ver_plantillas', 'documentos.gestionar_plantillas', cedula='20000001')


def crear_plantilla(admin, codigo='OFERTA', proceso='ingreso_ventana2', firma=True, campos=None, firmante='postulante', activar=True, publicar=True):
    r = admin.post(f'{DOC}/plantillas/', {
        'codigo': codigo, 'nombre': f'Documento {codigo}', 'modo': 'formulario', 'proceso': proceso,
        'firmante': firmante, 'requiere_firma_clic': firma}, format='json')
    assert r.status_code == 201, r.content
    pid = r.json()['data']['id']
    definicion = definicion_formulario()
    definicion['encabezado']['tipo'] = 'ninguno'
    definicion['bloques'] = [b for b in definicion['bloques'] if b['tipo'] in ('seccion', 'fila_campos', 'tabla')]
    texto = 'Declaro aspirar a {propio.sueldo} en {cargo}. ' if campos is None else 'Declaro lo anterior. '
    definicion['bloques'].append({'id': 'p', 'tipo': 'parrafo', 'texto': texto + 'Expediente {numero_expediente}.'})
    r = admin.put(f'{DOC}/plantillas/{pid}/', {
        'definicion': definicion, 'campos_propios': CAMPOS if campos is None else campos}, format='json')
    assert r.status_code == 200, r.content
    if publicar:
        assert admin.post(f'{DOC}/plantillas/{pid}/publicar/').status_code == 201
    if activar:
        assert admin.post(f'{DOC}/plantillas/{pid}/activar/', {'activa': True}, format='json').status_code == 200
    return pid


@pytest.fixture
def post(m2, admin_docs):
    crear_plantilla(admin_docs)
    return postulante_en_ventana2(m2, completa=True)


def lista(c):
    r = c.get(f'{BASE}/ventana2/documentos/')
    assert r.status_code == 200, r.content
    return datos(r)


def uno(c, codigo='OFERTA'):
    return next(d for d in lista(c) if d['codigo'] == codigo)


def guardar(c, valores, codigo='OFERTA'):
    return c.put(f'{BASE}/ventana2/documentos/{codigo}/', {'valores': valores}, format='json')


def firmar(c, acepto=True, codigo='OFERTA'):
    return c.post(f'{BASE}/ventana2/documentos/{codigo}/firmar/', {'acepto': acepto}, format='json', HTTP_USER_AGENT='Navegador/1.0')


def codigo_de(r):
    return (r.json().get('data') or {}).get('codigo')


# ------------------------------------------------------------------------------------------------ proveedor real
def test_el_proveedor_real_arma_las_variables_con_los_datos_del_expediente(m2, post):
    _, exp = post
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    d = ProveedorDatosExpedienteORM().datos_de(SUJETO, exp)
    assert d['nombres'] == 'ANA MARÍA' and d['apellidos'] == 'PÉREZ' and d['nombre_completo'] == 'PÉREZ ANA MARÍA'
    assert d['cedula'] == 'V-12345678' and d['cedula_numero'] == '12345678' and d['nacionalidad'] == 'VENEZOLANO'
    assert d['sexo'] == 'FEMENINO' and d['fecha_nacimiento'] == '17/05/1990' and int(d['edad']) >= 36
    assert d['rif'] == 'V-12345678-9' and d['numero_expediente'] == e.numero and d['correo'] == 'ana@ejemplo.invalid'
    assert d['telefono_celular'].startswith('+58')
    assert (d['estado_residencia'], d['municipio'], d['parroquia']) == ('MIRANDA', 'BARUTA', 'NUESTRA SENORA DEL ROSARIO')
    assert d['direccion'].startswith('AV. PRINCIPAL') and d['tenencia_vivienda'] == 'PROPIA'
    assert d['grupo_sanguineo'] == 'O+' and d['alergias'] == 'POLEN' and d['condiciones_salud'] == 'ASMA' and d['discapacidad'] == 'NO'
    assert (d['talla_camisa'], d['talla_pantalon'], d['talla_calzado']) == ('M', '32', '40')
    assert [f['parentesco'] for f in d['familiares']] == ['CONYUGE', 'HIJO(A)']
    assert d['familiares'][0]['nombre_completo'] == 'GÓMEZ LUIS' and d['familiares'][0]['fecha_nacimiento'] == '10/02/1988'
    assert d['estudios'][0]['institucion'] == 'UNIVERSIDAD CENTRAL DE VENEZUELA' and 'INGENIERIA' in d['estudios'][0]['titulo']
    assert d['profesion'] == 'INGENIERIA EN SISTEMAS'
    assert d['cursos'][0]['horas'] == '40' and d['antecedentes'][0]['institucion'] == 'SENIAT'
    assert {i['idioma'] for i in d['idiomas']} == {'INGLÉS', 'GUARANÍ'}
    assert d['foto'] and d['_foto_sha256'] == e.foto_sha256
    assert 'foto' not in ProveedorDatosExpedienteORM().datos_de(SUJETO, exp, con_foto=False)


# ------------------------------------------------------------------------------------------------ listado
def test_lista_solo_las_plantillas_publicadas_activas_de_la_ventana2(m2, admin_docs, post):
    c, _ = post
    crear_plantilla(admin_docs, 'CONTRATO', proceso='ingreso_contratacion', firma=False)
    crear_plantilla(admin_docs, 'OTRA', proceso='bajo_demanda')
    crear_plantilla(admin_docs, 'INACTIVA', activar=False)
    crear_plantilla(admin_docs, 'BORRADOR', publicar=False, activar=False)
    assert [d['codigo'] for d in lista(c)] == ['OFERTA']
    d = uno(c)
    assert d['estado'] == 'pendiente_datos' and d['requiere_firma'] is True and d['faltan'] == ['Sueldo al que aspira']
    assert d['firma'] is None and d['documento_id'] is None and 'Acepto y declaro' in d['texto_conformidad']
    assert [f['clave'] for f in d['campos_propios']] == ['sueldo', 'inicio', 'traslado', 'turno', 'notas']


def test_sin_plantillas_la_lista_esta_vacia_y_el_envio_no_se_bloquea(m2):
    c, _ = postulante_en_ventana2(m2, completa=True)
    assert lista(c) == []
    assert c.post(f'{BASE}/enviar/').status_code == 200


# ------------------------------------------------------------------------------------------------ campos propios
def test_guardar_campos_valida_por_tipo_y_normaliza(post):
    c, _ = post
    r = guardar(c, {'sueldo': '1500 USD', 'inicio': '2026-12-01', 'traslado': 'si', 'turno': 'NOCTURNO', 'notas': 'Línea 1\nLínea 2'})
    assert r.status_code == 200, r.content
    d = datos(r)
    assert d['estado'] == 'listo_para_revisar' and d['faltan'] == []
    assert d['valores'] == {'sueldo': '1500 USD', 'inicio': '01/12/2026', 'traslado': 'SI', 'turno': 'NOCTURNO', 'notas': 'Línea 1\nLínea 2'}
    assert ValoresDocumentoModel.objects.get().valores['inicio'] == '01/12/2026'
    assert uno(c)['valores']['sueldo'] == '1500 USD'


@pytest.mark.parametrize('valores, campo', [
    ({'inicio': '31/02/2026'}, 'valores.inicio'),
    ({'inicio': 'mañana'}, 'valores.inicio'),
    ({'traslado': 'quizás'}, 'valores.traslado'),
    ({'turno': 'VESPERTINO'}, 'valores.turno'),
    ({'sueldo': 'x' * 4001}, 'valores.sueldo'),
    ({'inventado': 'x'}, 'valores'),
])
def test_guardar_campos_rechaza_lo_que_no_cuadra_con_el_tipo(post, valores, campo):
    c, _ = post
    r = guardar(c, valores)
    assert r.status_code == 400, r.content
    assert ValoresDocumentoModel.objects.count() == 0


def test_los_obligatorios_pueden_quedar_vacios_mientras_se_llena(post):
    c, _ = post
    d = datos(guardar(c, {'sueldo': '', 'notas': 'algo'}))
    assert d['estado'] == 'pendiente_datos' and d['faltan'] == ['Sueldo al que aspira']


def test_un_documento_que_no_aplica_responde_404(post):
    c, _ = post
    assert guardar(c, {}, codigo='NO_EXISTE').status_code == 404
    assert c.get(f'{BASE}/ventana2/documentos/NO_EXISTE/vista-previa/').status_code == 404


# ------------------------------------------------------------------------------------------------ planilla prellenada
def test_ver_mi_planilla_genera_el_pdf_con_mis_datos_y_lo_llenado(post):
    c, exp = post
    guardar(c, {'sueldo': '1500 USD'})
    r = c.get(f'{BASE}/ventana2/documentos/OFERTA/vista-previa/')
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf' and r['Cache-Control'] == 'private, no-store'
    texto = texto_de(r.content)
    assert 'PÉREZ ANA MARÍA' in texto and 'V-12345678' in texto and '1500 USD' in texto
    assert 'GÓMEZ LUIS' in texto   # la tabla del grupo familiar sale con los datos de la Ventana 2
    assert ExpedientePostulacionModel.objects.get(pk=exp).numero in texto
    assert DocumentoGeneradoModel.objects.count() == 0   # la vista previa no se guarda ni firma


def test_la_planilla_sale_aunque_falten_obligatorios(post):
    c, _ = post
    assert c.get(f'{BASE}/ventana2/documentos/OFERTA/vista-previa/').status_code == 200


# ------------------------------------------------------------------------------------------------ firma por clic
def test_firmar_exige_la_casilla_y_los_obligatorios(post):
    c, _ = post
    assert firmar(c, acepto=False).status_code == 400
    r = firmar(c)
    assert r.status_code == 409 and 'Sueldo al que aspira' in r.json()['message']
    assert FirmaDocumentoModel.objects.count() == 0 and DocumentoGeneradoModel.objects.count() == 0


def test_la_firma_genera_el_documento_final_con_evidencia(post):
    c, exp = post
    guardar(c, {'sueldo': '1500 USD'})
    r = firmar(c)
    assert r.status_code == 200, r.content
    d = datos(r)
    assert d['estado'] == 'firmado' and d['firma_invalidada'] is False and d['documento_id']
    doc = DocumentoGeneradoModel.objects.get()
    firma = FirmaDocumentoModel.objects.get()
    assert (doc.sujeto_tipo, doc.sujeto_id) == (SUJETO, exp) and doc.datos_snapshot['propio.sueldo'] == '1500 USD'
    assert doc.datos_snapshot['cedula'] == 'V-12345678' and doc.huella_datos
    pdf = AlmacenCompartido().descargar(doc.pdf_clave)
    assert doc.pdf_sha256 == hashlib.sha256(pdf).hexdigest() == firma.sha256_firmado
    assert firma.firmante_tipo == 'postulante' and firma.firmante_id == '12345678'
    assert firma.user_agent == 'Navegador/1.0' and firma.ip and 'Acepto y declaro' in firma.texto_conformidad
    # la evidencia que ve el postulante lleva la IP enmascarada, nunca completa
    assert d['firma']['sha256'] == doc.pdf_sha256 and '•' in d['firma']['ip_enmascarada'] and d['firma']['ip_enmascarada'] != firma.ip
    assert AuditoriaLog.objects.filter(accion='POSTULANTE_DOCUMENTO_FIRMADO', recurso_id=exp).exists()
    # firmar otra vez lo vigente es 409 y no duplica
    assert firmar(c).status_code == 409 and FirmaDocumentoModel.objects.count() == 1
    # mi documento firmado se descarga con bitácora
    r = c.get(f'{BASE}/ventana2/documentos/OFERTA/archivo/')
    assert r.status_code == 200 and b''.join(r.streaming_content) == pdf
    assert AuditoriaLog.objects.filter(accion='DESCARGA_ARCHIVO', recurso_tipo='documento_firmado', recurso_id=doc.id).exists()


def test_cambiar_un_campo_propio_invalida_la_firma_y_al_firmar_de_nuevo_cambia_el_sha256(post):
    c, exp = post
    guardar(c, {'sueldo': '1500 USD'})
    firmar(c)
    primero = DocumentoGeneradoModel.objects.get()
    r = guardar(c, {'sueldo': '1800 USD'})
    d = datos(r)
    assert d['estado'] == 'listo_para_revisar' and d['firma_invalidada'] is True and d['firma'] is None
    assert AuditoriaLog.objects.filter(accion='POSTULANTE_DOCUMENTO_FIRMA_INVALIDADA', recurso_id=exp).exists()
    assert c.get(f'{BASE}/ventana2/documentos/OFERTA/archivo/').status_code == 404   # lo firmado ya no vale
    assert firmar(c).status_code == 200
    assert DocumentoGeneradoModel.objects.count() == 2
    segundo = DocumentoGeneradoModel.objects.exclude(pk=primero.pk).get()
    assert segundo.pdf_sha256 != primero.pdf_sha256 and segundo.huella_datos != primero.huella_datos
    assert uno(c)['documento_id'] == str(segundo.pk)


def test_cambiar_datos_de_la_ventana2_tambien_invalida_la_firma(m2, post):
    c, _ = post
    guardar(c, {'sueldo': '1500 USD'})
    firmar(c)
    assert uno(c)['estado'] == 'firmado'
    # la fecha de hoy NO invalida (la huella la ignora); un dato del postulante sí
    v2 = datos_v2_con_direccion(m2, 'Otra calle, casa 4')
    assert c.put(f'{BASE}/ventana2/', v2, format='json').status_code == 200
    d = uno(c)
    assert d['estado'] == 'listo_para_revisar' and d['firma_invalidada'] is True


def datos_v2_con_direccion(m2, direccion):
    from tests.integration.postulacion._ventana2_mundo import datos_v2
    base = datos_v2(m2.cat)
    base['vivienda']['direccion_exacta'] = direccion
    return {'vivienda': base['vivienda']}


def test_un_documento_sin_firma_no_se_firma(m2, admin_docs):
    crear_plantilla(admin_docs, 'SIN_FIRMA', firma=False, campos=[])
    c, _ = postulante_en_ventana2(m2, completa=True)
    assert uno(c, 'SIN_FIRMA')['requiere_firma'] is False and uno(c, 'SIN_FIRMA')['estado'] == 'listo_para_revisar'
    assert firmar(c, codigo='SIN_FIRMA').status_code == 409


def test_un_documento_que_firma_conatel_no_lo_firma_el_postulante(m2, admin_docs):
    crear_plantilla(admin_docs, 'SOLO_CONATEL', firmante='conatel', campos=[])
    c, _ = postulante_en_ventana2(m2, completa=True)
    assert uno(c, 'SOLO_CONATEL')['requiere_firma'] is False
    assert firmar(c, codigo='SOLO_CONATEL').status_code == 409
    assert c.post(f'{BASE}/enviar/').status_code == 200   # no cuenta como pendiente del postulante


# ------------------------------------------------------------------------------------------------ Zero-IDOR
def test_el_postulante_solo_ve_y_firma_lo_suyo(m2, admin_docs, post):
    c1, exp1 = post
    guardar(c1, {'sueldo': '1500 USD'})
    firmar(c1)
    c2, exp2 = postulante_en_ventana2(m2, cedula='87654321', completa=True)
    d2 = uno(c2)
    assert d2['estado'] == 'pendiente_datos' and d2['valores']['sueldo'] == '' and d2['firma'] is None
    assert c2.get(f'{BASE}/ventana2/documentos/OFERTA/archivo/').status_code == 404
    assert firmar(c2).status_code == 409   # sus obligatorios están vacíos: lo de otro no cuenta
    guardar(c2, {'sueldo': '999'})
    assert firmar(c2).status_code == 200
    doc2 = DocumentoGeneradoModel.objects.get(sujeto_id=exp2)
    assert doc2.datos_snapshot['cedula'] == 'V-87654321' and doc2.datos_snapshot['propio.sueldo'] == '999'
    assert FirmaDocumentoModel.objects.get(documento=doc2).firmante_id == '87654321'
    assert ValoresDocumentoModel.objects.get(sujeto_id=exp1).valores['sueldo'] == '1500 USD'
    # la URL no admite un expediente: el id sale solo de la sesión
    assert c2.get(f'{BASE}/ventana2/documentos/{exp1}/').status_code in (404, 405)


def test_un_empleado_o_un_anonimo_no_entran_a_las_rutas_del_postulante(m2, post):
    for cliente in (m2.captacion(), APIClient()):
        for r in (cliente.get(f'{BASE}/ventana2/documentos/'), cliente.put(f'{BASE}/ventana2/documentos/OFERTA/', {'valores': {}}, format='json'),
                  cliente.get(f'{BASE}/ventana2/documentos/OFERTA/vista-previa/'), firmar(cliente),
                  cliente.get(f'{BASE}/ventana2/documentos/OFERTA/archivo/')):
            assert r.status_code in (401, 403), r.content


def test_fuera_de_la_ventana2_el_postulante_no_toca_los_documentos(post):
    c, exp = post
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=timezone.now() - timedelta(days=1))
    assert c.get(f'{BASE}/ventana2/documentos/').status_code in (403, 409)   # VENTANA_VENCIDA
    ExpedientePostulacionModel.objects.filter(pk=exp).update(ventana_vence_el=timezone.now() + timedelta(days=1), estado='EN_REVISION_FINAL')
    assert guardar(c, {'sueldo': 'x'}).status_code in (401, 403, 409)


# ------------------------------------------------------------------------------------------------ enviar
def test_enviar_exige_los_documentos_llenos_y_firmados(post):
    c, exp = post
    r = c.post(f'{BASE}/enviar/')
    assert r.status_code == 400 and codigo_de(r) == 'VENTANA2_INCOMPLETA'
    f = [x for x in r.json()['data']['faltantes'] if x['seccion'] == 'documentos']
    assert f == [{'seccion': 'documentos', 'campo': 'documentos.OFERTA',
                  'mensaje': 'Complete los datos del documento «Documento OFERTA»: Sueldo al que aspira.'}]
    assert any(x['campo'] == 'documentos.OFERTA' for x in datos(c.get(f'{BASE}/ventana2/'))['faltantes'])
    guardar(c, {'sueldo': '1500 USD'})
    r = c.post(f'{BASE}/enviar/')
    assert r.status_code == 400
    assert [x['mensaje'] for x in r.json()['data']['faltantes'] if x['seccion'] == 'documentos'] == ['Firme el documento «Documento OFERTA».']
    firmar(c)
    r = c.post(f'{BASE}/enviar/')
    assert r.status_code == 200, r.content
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'EN_REVISION_FINAL'


def test_una_firma_invalidada_se_pide_con_un_mensaje_claro(post):
    c, _ = post
    guardar(c, {'sueldo': '1'})
    firmar(c)
    guardar(c, {'sueldo': '2'})
    r = c.post(f'{BASE}/enviar/')
    assert 'quedó sin efecto' in [x['mensaje'] for x in r.json()['data']['faltantes'] if x['seccion'] == 'documentos'][0]


def test_mi_expediente_cuenta_los_documentos_pendientes_desde_el_inicio(post):
    c, _ = post
    d = datos(c.get(f'{BASE}/mi-expediente/'))
    assert [f['campo'] for f in d['faltantes_ventana2'] if f['seccion'] == 'documentos'] == ['documentos.OFERTA']
    assert 'documentos.OFERTA' in d['campos_pendientes']
    guardar(c, {'sueldo': '1'})
    firmar(c)
    d = datos(c.get(f'{BASE}/mi-expediente/'))
    assert not [f for f in d['faltantes_ventana2'] if f['seccion'] == 'documentos']


# ------------------------------------------------------------------------------------------------ Captación
def test_captacion_ve_el_estado_la_evidencia_y_descarga_con_bitacora(m2, post):
    c, exp = post
    cap = m2.captacion()
    r = cap.get(f'{BASE}/expedientes/{exp}/documentos/')
    assert r.status_code == 200
    d = datos(r)[0]
    assert d['estado'] == 'pendiente_datos' and d['firma'] is None and d['archivo_url'].endswith(f'/expedientes/{exp}/documentos/OFERTA/archivo/')
    guardar(c, {'sueldo': '1500 USD'})
    firmar(c)
    d = datos(cap.get(f'{BASE}/expedientes/{exp}/documentos/'))[0]
    assert d['estado'] == 'firmado' and d['valores']['sueldo'] == '1500 USD'
    assert '•' in d['firma']['ip_enmascarada'] and len(d['firma']['sha256']) == 64 and d['firma']['firmado_en']
    r = cap.get(f'{BASE}/expedientes/{exp}/documentos/OFERTA/archivo/')
    assert r.status_code == 200 and r['X-Documento-Firmado'] == 'si' and r['Content-Type'] == 'application/pdf'
    cuerpo = b''.join(r.streaming_content)
    assert hashlib.sha256(cuerpo).hexdigest() == d['firma']['sha256'] and '1500 USD' in texto_de(cuerpo)
    log = AuditoriaLog.objects.filter(accion='DESCARGA_ARCHIVO', recurso_tipo='documento_expediente', recurso_id=d['firma']['documento_id'])
    assert log.count() == 1 and log.first().actor_cedula == '20000001'


def test_captacion_ve_la_vista_actual_de_lo_no_firmado(m2, post):
    c, exp = post
    guardar(c, {'sueldo': '777 USD'})
    r = m2.captacion().get(f'{BASE}/expedientes/{exp}/documentos/OFERTA/archivo/')
    assert r.status_code == 200 and r['X-Documento-Firmado'] == 'no' and '777 USD' in texto_de(r.content)
    assert AuditoriaLog.objects.filter(accion='DESCARGA_ARCHIVO', recurso_tipo='documento_vista_actual').exists()
    assert m2.captacion().get(f'{BASE}/expedientes/{exp}/documentos/NO_EXISTE/archivo/').status_code == 404


def test_captacion_sin_el_permiso_de_la_bandeja_no_ve_los_documentos(m2, post):
    _, exp = post
    sin = m2.captacion('postulacion.registrar_psicofisico')
    assert sin.get(f'{BASE}/expedientes/{exp}/documentos/').status_code == 403
    assert sin.get(f'{BASE}/expedientes/{exp}/documentos/OFERTA/archivo/').status_code == 403
    assert APIClient().get(f'{BASE}/expedientes/{exp}/documentos/').status_code in (401, 403)
    assert m2.captacion().get(f'{BASE}/expedientes/00000000-0000-0000-0000-000000000000/documentos/').status_code == 404


# ------------------------------------------------------------------------------------------------ contratación
def test_al_contratar_los_documentos_quedan_vinculados_y_se_generan_los_de_contratacion(m2, admin_docs):
    crear_plantilla(admin_docs, 'OFERTA')
    crear_plantilla(admin_docs, 'CONTRATO', proceso='ingreso_contratacion', firma=False, campos=[])
    exp = listo_para_asignar(m2)
    # un documento ya firmado en la Ventana 2 (generado directo, como lo dejaría la firma por clic)
    from apps.documentos.application.use_cases.documentos_sujeto import firmar_por_clic, guardar_campos_propios
    from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
    from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM
    prov, rp, rd = ProveedorDatosExpedienteORM(), RepoPlantillasORM(), RepoDocumentosORM()
    guardar_campos_propios(rp, rd, prov, sujeto_tipo=SUJETO, sujeto_id=exp, codigo='OFERTA', valores={'sueldo': '10'})
    firmar_por_clic(rp, rd, prov, MotorPdfDocumentos(), AlmacenCompartido(), sujeto_tipo=SUJETO, sujeto_id=exp,
                    codigo='OFERTA', firmante_id='12345678', ip='190.12.5.9', user_agent='x', acepta=True)
    assert DocumentoGeneradoModel.objects.filter(trabajador_cedula='').count() == 1

    r = m2.captacion().post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json')
    assert r.status_code == 200, r.content
    docs = DocumentoGeneradoModel.objects.order_by('created_at')
    assert docs.count() == 2 and set(docs.values_list('trabajador_cedula', flat=True)) == {'12345678'}
    assert EmployeeModel.objects.filter(cedulaidentidad='12345678').exists()
    contrato = docs.get(plantilla__codigo='CONTRATO')
    assert contrato.sujeto_id == exp and contrato.datos_snapshot['cedula'] == 'V-12345678'
    # Captación ve los de contratación una vez contratado, y el firmado sigue vigente
    items = {d['codigo']: d for d in datos(m2.captacion().get(f'{BASE}/expedientes/{exp}/documentos/'))}
    assert items['CONTRATO']['estado'] == 'generado' and items['CONTRATO']['trabajador_cedula'] == '12345678'
    assert items['OFERTA']['estado'] == 'firmado'
    r = m2.captacion().get(f'{BASE}/expedientes/{exp}/documentos/CONTRATO/archivo/')
    assert r.status_code == 200 and r['X-Documento-Firmado'] == 'si'


def test_si_falla_la_generacion_de_contratacion_se_revierte_toda_la_promocion(m2, admin_docs, monkeypatch):
    crear_plantilla(admin_docs, 'CONTRATO', proceso='ingreso_contratacion', firma=False, campos=[])
    exp = listo_para_asignar(m2)

    def falla(self, contexto, datos_):
        raise RuntimeError('motor caído')

    monkeypatch.setattr('apps.documentos.infrastructure.pdf.motor.MotorPdfDocumentos.renderizar', falla)
    r = m2.captacion(sin_excepciones=True).post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json')
    assert r.status_code >= 400
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'LISTO_PARA_ASIGNAR'
    assert not EmployeeModel.objects.filter(cedulaidentidad='12345678').exists()
    assert DocumentoGeneradoModel.objects.count() == 0


def test_sin_plantillas_de_contratacion_se_contrata_igual(m2):
    exp = listo_para_asignar(m2)
    assert m2.captacion().post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json').status_code == 200
    assert DocumentoGeneradoModel.objects.count() == 0
