"""API de plantillas: permisos, ciclo borrador → publicada, versionado inmutable, fondo, vista previa y descargas."""
import copy

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.documentos.infrastructure.models.documentos_models import (
    PlantillaDocumentoModel,
    VersionPlantillaDocumentoModel,
)
from tests.unit.documentos._ayudas import (
    CAMPOS_PROPIOS,
    definicion_formulario,
    definicion_overlay,
    paginas_de,
    pdf_fondo,
    texto_de,
)

pytestmark = pytest.mark.django_db

BASE = '/api/v1/documentos'


def _crear(api, modo='formulario', codigo='DOC_PRUEBA', **extra):
    cuerpo = {'codigo': codigo, 'nombre': 'Documento de prueba', 'modo': modo, 'momento': 'ventana2',
              'firmante': 'postulante', 'requiere_firma_clic': True, **extra}
    r = api.post(f'{BASE}/plantillas/', cuerpo, format='json')
    assert r.status_code == 201, r.data
    return r.data['data']


def _formulario_completo(api, codigo='DOC_PRUEBA'):
    p = _crear(api, codigo=codigo)
    r = api.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': definicion_formulario(), 'campos_propios': CAMPOS_PROPIOS}, format='json')
    assert r.status_code == 200, r.data
    return r.data['data']


def _subir_fondo(api, plantilla_id, contenido=None, nombre='oficial.pdf'):
    archivo = SimpleUploadedFile(nombre, contenido or pdf_fondo(2), content_type='application/pdf')
    return api.post(f'{BASE}/plantillas/{plantilla_id}/fondo/', {'archivo': archivo}, format='multipart')


# ─── permisos ───

@pytest.mark.parametrize('metodo, ruta', [
    ('get', '/variables/'), ('get', '/plantillas/'), ('post', '/plantillas/'),
])
def test_sin_permisos_responde_403(sin_permisos, metodo, ruta):
    assert getattr(sin_permisos, metodo)(f'{BASE}{ruta}', {}, format='json').status_code == 403


def test_el_lector_ve_pero_no_gestiona(admin, lector):
    p = _crear(admin)
    assert lector.get(f'{BASE}/plantillas/').status_code == 200
    assert lector.get(f"{BASE}/plantillas/{p['id']}/").status_code == 200
    assert lector.post(f'{BASE}/plantillas/', {'codigo': 'X'}, format='json').status_code == 403
    assert lector.put(f"{BASE}/plantillas/{p['id']}/", {}, format='json').status_code == 403
    for accion in ('publicar', 'duplicar', 'activar', 'fondo', 'logo'):
        assert lector.post(f"{BASE}/plantillas/{p['id']}/{accion}/", {}, format='json').status_code == 403
    assert lector.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {}, format='json').status_code == 200


def test_el_catalogo_de_variables_se_publica(lector):
    d = lector.get(f'{BASE}/variables/').data['data']
    claves = {v['clave'] for v in d['variables']}
    assert {'nombre_completo', 'familiares', 'estudios', 'idiomas'} <= claves
    assert set(d['tipos_bloque']) >= {'seccion', 'fila_campos', 'casillas', 'tabla', 'parrafo', 'foto', 'firmas', 'salto_pagina'}


# ─── ciclo de vida ───

def test_crear_guardar_y_codigo_repetido(admin):
    p = _formulario_completo(admin)
    assert p['estado'] == 'borrador' and p['ultima_version'] == 0 and not p['activa']
    assert len(p['definicion']['bloques']) == 8
    r = admin.post(f'{BASE}/plantillas/', {'codigo': 'doc_prueba', 'nombre': 'otra', 'modo': 'formulario'}, format='json')
    assert r.status_code == 409


def test_guardar_con_variable_desconocida_devuelve_400(admin):
    p = _crear(admin)
    d = definicion_formulario()
    d['bloques'][4]['texto'] = '{no_existe}'
    r = admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': d, 'campos_propios': CAMPOS_PROPIOS}, format='json')
    assert r.status_code == 400


def test_publicar_crea_version_inmutable_y_detecta_cambios(admin):
    p = _formulario_completo(admin)
    r = admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    assert r.status_code == 201 and r.data['data']['version']['numero'] == 1
    assert r.data['data']['plantilla']['estado'] == 'publicada'
    assert not r.data['data']['plantilla']['cambios_sin_publicar']

    # sin cambios no se republica
    assert admin.post(f"{BASE}/plantillas/{p['id']}/publicar/").status_code == 409

    # editar el borrador no toca la versión publicada
    d = copy.deepcopy(definicion_formulario())
    d['encabezado']['titulo'] = 'Título nuevo'
    guardada = admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': d, 'campos_propios': CAMPOS_PROPIOS}, format='json').data['data']
    assert guardada['cambios_sin_publicar'] is True
    version1 = VersionPlantillaDocumentoModel.objects.get(plantilla_id=p['id'], numero=1)
    assert version1.definicion['encabezado']['titulo'] == 'Documento de prueba'

    r2 = admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    assert r2.data['data']['version']['numero'] == 2
    versiones = admin.get(f"{BASE}/plantillas/{p['id']}/versiones/").data['data']
    assert [v['numero'] for v in versiones] == [2, 1]


def test_una_version_publicada_no_se_modifica_ni_se_borra(admin):
    p = _formulario_completo(admin)
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    v = VersionPlantillaDocumentoModel.objects.get(plantilla_id=p['id'])
    v.definicion = {}
    with pytest.raises(PermissionError):
        v.save()
    with pytest.raises(PermissionError):
        v.delete()


def test_publicar_exige_contenido(admin):
    p = _crear(admin)
    assert admin.post(f"{BASE}/plantillas/{p['id']}/publicar/").status_code == 400
    po = _crear(admin, modo='pdf_overlay', codigo='OV')
    assert admin.post(f"{BASE}/plantillas/{po['id']}/publicar/").status_code == 400


def test_activar_exige_publicada_y_el_codigo_queda_fijo(admin):
    p = _formulario_completo(admin)
    assert admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json').status_code == 409
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    r = admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')
    assert r.status_code == 200 and r.data['data']['activa'] is True
    assert admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': 'si'}, format='json').status_code == 400
    assert admin.put(f"{BASE}/plantillas/{p['id']}/", {'codigo': 'OTRO'}, format='json').status_code == 400
    r = admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': False}, format='json')
    assert r.data['data']['activa'] is False


def test_duplicar_crea_un_borrador_independiente(admin):
    p = _formulario_completo(admin)
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')
    copia = admin.post(f"{BASE}/plantillas/{p['id']}/duplicar/").data['data']
    assert copia['id'] != p['id'] and copia['estado'] == 'borrador' and not copia['activa']
    assert copia['codigo'] == 'DOC_PRUEBA_COPIA' and copia['definicion'] == p['definicion']
    segunda = admin.post(f"{BASE}/plantillas/{p['id']}/duplicar/").data['data']
    assert segunda['codigo'] == 'DOC_PRUEBA_COPIA2'


# ─── fondo (formato de terceros) ───

def test_subir_fondo_valida_y_guarda_con_clave_opaca(admin, almacen):
    p = _crear(admin, modo='pdf_overlay', codigo='OV')
    r = _subir_fondo(admin, p['id'])
    assert r.status_code == 200, r.data
    datos = r.data['data']
    assert [(x['numero'], x['ancho_pt']) for x in datos['fondo_paginas']] == [(1, 540.0), (2, 540.0)]
    assert 'fondo_clave' not in datos
    claves = list(almacen.objetos)
    assert len(claves) == 1 and claves[0].startswith('documentos/fondos/') and 'oficial' not in claves[0]


@pytest.mark.parametrize('nombre, contenido, codigo', [
    ('falso.pdf', b'GIF89a no es pdf', 400),            # firma real
    ('fondo.png', b'%PDF-1.4 cualquier cosa', 400),     # extensión
    ('roto.pdf', b'%PDF-1.4 truncado sin estructura', 400),  # ilegible
    ('grande.pdf', b'%PDF-' + b'0' * (15 * 1024 * 1024 + 1), 400),  # > 15 MB
])
def test_subir_fondo_invalido(admin, almacen, nombre, contenido, codigo):
    p = _crear(admin, modo='pdf_overlay', codigo='OV')
    assert _subir_fondo(admin, p['id'], contenido, nombre).status_code == codigo
    assert almacen.objetos == {}


def test_el_fondo_solo_aplica_a_formato_de_terceros(admin, almacen):
    p = _crear(admin)
    assert _subir_fondo(admin, p['id']).status_code == 400


def test_paginas_de_fondo_png_y_overlay_completo(admin, almacen):
    p = _crear(admin, modo='pdf_overlay', codigo='OV')
    _subir_fondo(admin, p['id'])
    png = admin.get(f"{BASE}/plantillas/{p['id']}/fondo/paginas/2/")
    assert png.status_code == 200 and png.content.startswith(b'\x89PNG')
    assert admin.get(f"{BASE}/plantillas/{p['id']}/fondo/paginas/9/").status_code == 404

    r = admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': definicion_overlay((1, 2))}, format='json')
    assert r.status_code == 200, r.data
    assert admin.post(f"{BASE}/plantillas/{p['id']}/publicar/").status_code == 201
    # una página inexistente no se acepta
    r = admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': definicion_overlay((5,))}, format='json')
    assert r.status_code == 400


def test_logo_propio(admin, almacen):
    p = _crear(admin)
    png = b'\x89PNG\r\n\x1a\n' + b'0' * 40
    ok = admin.post(f"{BASE}/plantillas/{p['id']}/logo/", {'archivo': SimpleUploadedFile('l.png', png)}, format='multipart')
    assert ok.status_code == 200
    enc = ok.data['data']['definicion']['encabezado']
    assert enc['tipo'] == 'logo_propio' and enc['logo_clave'].startswith('documentos/logos/')
    malo = admin.post(f"{BASE}/plantillas/{p['id']}/logo/", {'archivo': SimpleUploadedFile('l.png', b'no imagen')}, format='multipart')
    assert malo.status_code == 400


# ─── vista previa ───

def test_vista_previa_formulario_guardado_y_con_cambios_sin_guardar(admin, almacen):
    p = _formulario_completo(admin)
    r = admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {}, format='json')
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf'
    assert 'DOCUMENTO DE PRUEBA' in texto_de(r.content)

    d = definicion_formulario()
    d['encabezado']['titulo'] = 'Cambio sin guardar'
    r = admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {'definicion': d, 'campos_propios': CAMPOS_PROPIOS}, format='json')
    assert 'CAMBIO SIN GUARDAR' in texto_de(r.content)
    d['bloques'][4]['texto'] = '{inventada}'
    assert admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {'definicion': d, 'campos_propios': CAMPOS_PROPIOS}, format='json').status_code == 400


def test_vista_previa_overlay(admin, almacen):
    p = _crear(admin, modo='pdf_overlay', codigo='OV')
    _subir_fondo(admin, p['id'])
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': definicion_overlay((2,))}, format='json')
    r = admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {}, format='json')
    assert r.status_code == 200 and paginas_de(r.content) == 1
    assert 'PÉREZ RODRÍGUEZ JUAN ALBERTO' in texto_de(r.content)


# ─── siembra de ejemplo ───

def test_sembrar_plantillas_de_ejemplo_es_idempotente_y_usa_el_almacen_falso(almacen, tmp_path):
    from django.core.management import call_command
    from tests.unit.documentos._ayudas import pdf_fondo as fondo

    pdf = tmp_path / 'caja.pdf'
    pdf.write_bytes(fondo(1))
    for _ in range(2):
        call_command('sembrar_plantillas_documentos', '--pdf-caja-ahorro', str(pdf))
    codigos = set(PlantillaDocumentoModel.objects.values_list('codigo', flat=True))
    assert codigos == {'NOTIFICACION_ITINERANCIA', 'AFILIACION_CAJA_AHORRO'}
    assert not PlantillaDocumentoModel.objects.filter(ultima_version__gt=0).exists()  # en borrador
    assert len(almacen.objetos) == 1  # el PDF fue solo al almacén falso, una vez
    caja = PlantillaDocumentoModel.objects.get(codigo='AFILIACION_CAJA_AHORRO')
    assert caja.modo == 'pdf_overlay' and caja.definicion['paginas'][0]['campos']


def test_las_plantillas_de_ejemplo_se_publican_y_se_ven(admin, almacen, tmp_path):
    from django.core.management import call_command
    pdf = tmp_path / 'caja.pdf'
    pdf.write_bytes(pdf_fondo(1))
    call_command('sembrar_plantillas_documentos', '--pdf-caja-ahorro', str(pdf))
    for codigo in ('NOTIFICACION_ITINERANCIA', 'AFILIACION_CAJA_AHORRO'):
        m = PlantillaDocumentoModel.objects.get(codigo=codigo)
        r = admin.post(f'{BASE}/plantillas/{m.id}/vista-previa/', {}, format='json')
        assert r.status_code == 200, r.data
        assert admin.post(f'{BASE}/plantillas/{m.id}/publicar/').status_code == 201
    itinerancia = PlantillaDocumentoModel.objects.get(codigo='NOTIFICACION_ITINERANCIA')
    texto = texto_de(admin.post(f'{BASE}/plantillas/{itinerancia.id}/vista-previa/', {}, format='json').content)
    plano = ' '.join(texto.split())
    assert 'NOTIFICACIÓN ITINERE' in plano and 'Texto de ejemplo para «Ruta de acceso' in plano
