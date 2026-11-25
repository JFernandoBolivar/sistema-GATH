"""N-1 y N-4: proceso de la plantilla (API, migración de datos), generación bajo demanda y permisos de descarga."""
import datetime
import hashlib
import importlib

import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.documentos.application.use_cases.gestionar_plantillas import huella_borrador
from apps.documentos.domain.services.catalogo_procesos import CATALOGO_PROCESOS
from apps.documentos.infrastructure.models.documentos_models import (
    DocumentoGeneradoModel,
    PlantillaDocumentoModel,
    VersionPlantillaDocumentoModel,
)
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoPlantillasORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.documentos.conftest import Usuario
from tests.integration.documentos.test_plantillas_api import BASE, _crear
from tests.unit.documentos._ayudas import definicion_formulario, texto_de

pytestmark = pytest.mark.django_db
PC = 'punto_cuenta:cambio_oficina'


def _cliente(*permisos):
    c = APIClient()
    c.force_authenticate(user=Usuario(permisos))
    return c


def _definicion(texto):
    d = definicion_formulario()
    d['bloques'] = [{'id': 'p', 'tipo': 'parrafo', 'texto': texto, 'alineacion': 'justificado'}]
    return d


# ───────────────────────── catálogo y validación por la API ─────────────────────────

def test_variables_devuelve_los_procesos_y_filtra_por_proceso(lector):
    datos = lector.get(f'{BASE}/variables/').json()['data']
    assert [p['codigo'] for p in datos['procesos']] == [p.codigo for p in CATALOGO_PROCESOS]
    assert {'codigo', 'etiqueta', 'descripcion', 'grupo', 'grupos_variables'} <= set(datos['procesos'][0])
    assert 'momentos' not in datos
    todas = {v['clave'] for v in datos['variables']}
    de_pc = lector.get(f'{BASE}/variables/?proceso={PC}').json()['data']
    claves = {v['clave'] for v in de_pc['variables']}
    assert de_pc['proceso'] == PC and 'origen' in claves and 'talla_camisa' not in claves and claves < todas
    assert lector.get(f'{BASE}/variables/?proceso=nunca').status_code == 400


def test_una_plantilla_lleva_su_proceso_con_etiqueta_y_grupo(admin):
    p = _crear(admin, proceso=PC)
    assert (p['proceso'], p['proceso_etiqueta'], p['grupo']) == (PC, 'Punto de Cuenta: cambio de oficina', 'punto_cuenta')
    assert 'momento' not in p
    sin_proceso = admin.post(f'{BASE}/plantillas/', {'codigo': 'SIN_PROCESO', 'nombre': 'N', 'modo': 'formulario'}, format='json')
    assert sin_proceso.json()['data']['proceso'] == 'bajo_demanda'
    assert admin.post(f'{BASE}/plantillas/', {'codigo': 'MALO', 'nombre': 'N', 'modo': 'formulario', 'proceso': 'ventana2'},
                      format='json').status_code == 400


def test_la_api_rechaza_variables_de_otro_proceso_y_acepta_las_propias(admin):
    p = _crear(admin, proceso='ingreso_ventana2')
    r = admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('Desde {origen}')}, format='json')
    assert r.status_code == 400 and 'origen' in str(r.json())
    ok = admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('{nombre_completo} {talla_camisa}')}, format='json')
    assert ok.status_code == 200
    q = _crear(admin, codigo='DOC_PC', proceso=PC)
    assert admin.put(f"{BASE}/plantillas/{q['id']}/", {'definicion': _definicion('Desde {origen} hacia {destino}')},
                     format='json').status_code == 200
    assert admin.put(f"{BASE}/plantillas/{q['id']}/", {'definicion': _definicion('{talla_camisa}')}, format='json').status_code == 400


def test_cambiar_de_proceso_revalida_el_borrador_y_se_bloquea_al_publicar(admin):
    p = _crear(admin, codigo='DOC_CAMBIO', proceso=PC)
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('Desde {origen}')}, format='json')
    assert admin.put(f"{BASE}/plantillas/{p['id']}/", {'proceso': 'ingreso_ventana2'}, format='json').status_code == 400
    assert admin.put(f"{BASE}/plantillas/{p['id']}/", {'proceso': 'movimiento:traslado'}, format='json').status_code == 200
    assert admin.post(f"{BASE}/plantillas/{p['id']}/publicar/").status_code == 201
    r = admin.put(f"{BASE}/plantillas/{p['id']}/", {'proceso': PC}, format='json')
    assert r.status_code == 400 and 'no se puede cambiar' in str(r.json())


def test_la_vista_previa_usa_solo_datos_del_proceso(admin):
    p = _crear(admin, codigo='DOC_VP', proceso=PC)
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('Origen: {origen}')}, format='json')
    r = admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {}, format='json')
    assert r.status_code == 200 and 'GERENCIA DE OPERACIONES' in texto_de(r.content)


def test_la_vista_previa_acepta_un_proceso_nuevo_no_guardado_y_sus_variables(admin):
    p = _crear(admin, codigo='DOC_VP_CAMBIO', proceso='ingreso_ventana2')
    r = admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {
        'proceso': PC, 'definicion': _definicion('Origen: {origen}; destino: {destino}'),
    }, format='json')
    assert r.status_code == 200, r.content
    texto = ' '.join(texto_de(r.content).split())
    assert 'GERENCIA DE OPERACIONES' in texto and 'DIRECCIÓN DE ADMINISTRACIÓN' in texto
    assert RepoPlantillasORM().obtener(p['id']).proceso == 'ingreso_ventana2'  # la vista previa no guarda

    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('{nombre_completo}')}, format='json')
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    r = admin.post(f"{BASE}/plantillas/{p['id']}/vista-previa/", {
        'proceso': PC, 'definicion': _definicion('{origen}'),
    }, format='json')
    assert r.status_code == 400 and 'no se puede cambiar' in str(r.json())


# ───────────────────────── migración de datos momento → proceso ─────────────────────────

def _estado_historico():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor
    from django.test import override_settings
    with override_settings(MIGRATION_MODULES={}):
        return MigrationExecutor(connection).loader.project_state([('documentos', '0003_catalogo_procesos')]).apps


def _huella_vieja(version, meta):
    import json
    contenido = {'modo': version.modo, 'definicion': version.definicion, 'campos_propios': version.campos_propios,
                 'fondo_sha256': version.fondo_sha256,
                 'metadatos': {'nombre': meta['nombre'], 'momento': meta['momento'], 'firmante': meta['firmante'],
                               'requiere_firma_clic': meta['requiere_firma_clic']}}
    return hashlib.sha256(json.dumps(contenido, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


@pytest.mark.parametrize('viejo, nuevo', [
    ('ventana2', 'ingreso_ventana2'), ('contratacion', 'ingreso_contratacion'), ('otro', 'bajo_demanda')])
def test_la_migracion_pasa_el_momento_al_proceso_y_conserva_la_huella(admin, viejo, nuevo):
    mig = importlib.import_module('apps.documentos.migrations.0003_catalogo_procesos')
    p = _crear(admin, codigo='VIEJA', proceso=nuevo)
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('{nombre_completo}')}, format='json')
    assert admin.post(f"{BASE}/plantillas/{p['id']}/publicar/").status_code == 201
    # Se deja la base como estaba antes de N-1: valor viejo, metadatos con «momento» y su huella vieja.
    version = VersionPlantillaDocumentoModel.objects.get(plantilla_id=p['id'])
    meta = {**version.metadatos, 'momento': viejo}
    meta.pop('proceso')
    VersionPlantillaDocumentoModel.objects.filter(pk=version.pk).update(
        metadatos=meta, definicion_sha256=_huella_vieja(version, meta))
    PlantillaDocumentoModel.objects.filter(pk=p['id']).update(proceso=viejo)

    mig.adelante(_estado_historico(), None)

    plantilla = RepoPlantillasORM().obtener(p['id'])
    version.refresh_from_db()
    assert plantilla.proceso == nuevo and version.metadatos['proceso'] == nuevo and 'momento' not in version.metadatos
    assert version.definicion_sha256 == huella_borrador(plantilla)
    assert plantilla.cambios_sin_publicar is False and plantilla.activa is False

    mig.adelante(_estado_historico(), None)  # segunda ejecución: no cambia el resultado
    version.refresh_from_db()
    assert version.definicion_sha256 == huella_borrador(plantilla)

    mig.atras(_estado_historico(), None)
    assert PlantillaDocumentoModel.objects.get(pk=p['id']).proceso == viejo
    version.refresh_from_db()
    assert version.metadatos['momento'] == viejo and version.definicion_sha256 == _huella_vieja(version, version.metadatos)


def test_la_migracion_copia_codigo_nombre_y_proceso_a_los_documentos_ya_generados(admin, almacen):
    from apps.documentos.application.use_cases.generar_documento import generar_documento
    from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
    from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM
    mig = importlib.import_module('apps.documentos.migrations.0003_catalogo_procesos')

    class Motor(MotorPdfDocumentos):
        def renderizar(self, contexto, datos):
            return super().renderizar({**contexto, 'config_pdf': None}, datos)

    class Proveedor:
        def datos_de(self, *a, **k):
            return {'nombre_completo': 'ANA'}

    p = _crear(admin, codigo='GEN', proceso='ingreso_ventana2')
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('{nombre_completo}')}, format='json')
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')
    doc = generar_documento(RepoPlantillasORM(), RepoDocumentosORM(), Proveedor(), Motor(), almacen, plantilla_id=p['id'],
                            sujeto_tipo='x', sujeto_id='1', actor_id=None)
    DocumentoGeneradoModel.objects.filter(pk=doc.id).update(plantilla_codigo='', plantilla_nombre='', proceso='bajo_demanda')
    # El borrador cambió después de publicar: el documento debe conservar el
    # proceso de la VERSIÓN usada, no el proceso actual de la plantilla.
    PlantillaDocumentoModel.objects.filter(pk=p['id']).update(proceso='ventana2')
    VersionPlantillaDocumentoModel.objects.filter(plantilla_id=p['id']).update(
        metadatos={**VersionPlantillaDocumentoModel.objects.get(plantilla_id=p['id']).metadatos,
                   'proceso': 'ingreso_contratacion'},
    )
    mig.adelante(_estado_historico(), None)
    d = DocumentoGeneradoModel.objects.get(pk=doc.id)
    assert (d.plantilla_codigo, d.plantilla_nombre, d.proceso) == (
        'GEN', 'Documento de prueba', 'ingreso_contratacion',
    )


# ───────────────────────── bajo demanda ─────────────────────────

@pytest.fixture
def trabajador():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    return EmployeeModel.objects.create(
        cedulaidentidad='12345678', nombres='ana maría', apellidos='pérez', fecha_nacimiento=datetime.date(1990, 1, 1),
        sexoid=sexo, total_anos_apn=0, rif='123456789')


@pytest.fixture
def generador():
    return _cliente('documentos.generar_bajo_demanda')


@pytest.fixture
def constancia(admin):
    p = _crear(admin, codigo='CONSTANCIA', proceso='bajo_demanda', requiere_firma_clic=False)
    campos = [{'clave': 'dirigida_a', 'etiqueta': 'Dirigida a', 'tipo': 'texto', 'obligatorio': True}]
    definicion = _definicion('Se hace constar que {nombre_completo}, {cedula}, solicita la constancia ante {propio.dirigida_a}.')
    assert admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': definicion, 'campos_propios': campos},
                     format='json').status_code == 200
    assert admin.post(f"{BASE}/plantillas/{p['id']}/publicar/").status_code == 201
    assert admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json').status_code == 200
    return p


@pytest.fixture
def con_motor_sin_cintillo(monkeypatch):
    from apps.documentos.infrastructure.pdf import motor as m
    monkeypatch.setattr(m, '_config_institucional', lambda: None)


def test_el_listado_bajo_demanda_exige_el_permiso_nuevo(admin, lector, sin_permisos, trabajador):
    url = f'{BASE}/bajo-demanda/?trabajador_cedula=12345678'
    assert sin_permisos.get(url).status_code == 403
    assert lector.get(url).status_code == 403  # ver plantillas no basta
    assert admin.get(url).status_code == 403
    assert sin_permisos.post(f'{BASE}/bajo-demanda/generar/', {}, format='json').status_code == 403


def test_lista_solo_las_plantillas_bajo_demanda_publicadas_y_activas(admin, generador, trabajador, constancia):
    otra = _crear(admin, codigo='OTRA_DEMANDA', proceso='bajo_demanda')  # en borrador
    ingreso = _crear(admin, codigo='DE_INGRESO', proceso='ingreso_ventana2')
    for q in (otra, ingreso):
        admin.put(f"{BASE}/plantillas/{q['id']}/", {'definicion': _definicion('{cedula}')}, format='json')
        admin.post(f"{BASE}/plantillas/{q['id']}/publicar/")
        admin.post(f"{BASE}/plantillas/{q['id']}/activar/", {'activa': True}, format='json')
    admin.post(f"{BASE}/plantillas/{otra['id']}/activar/", {'activa': False}, format='json')
    datos = generador.get(f'{BASE}/bajo-demanda/?trabajador_cedula=12345678').json()['data']
    assert [p['codigo'] for p in datos['plantillas']] == ['CONSTANCIA']
    assert datos['plantillas'][0]['campos_propios'][0]['clave'] == 'dirigida_a' and datos['generados'] == []


def test_el_listado_reune_documentos_de_todos_los_procesos_del_trabajador(generador, trabajador, constancia):
    plantilla = PlantillaDocumentoModel.objects.get(pk=constancia['id'])
    version = VersionPlantillaDocumentoModel.objects.get(plantilla=plantilla)
    procesos = ('ingreso_contratacion', PC, 'movimiento:traslado', 'bajo_demanda')
    docs = [DocumentoGeneradoModel.objects.create(
        plantilla=plantilla, version=version, sujeto_tipo=f'sujeto_{i}', sujeto_id=str(i),
        datos_snapshot={}, pdf_clave=f'documentos/{i}.pdf', pdf_sha256='0' * 64,
        trabajador_cedula='12345678', plantilla_codigo=plantilla.codigo,
        plantilla_nombre=plantilla.nombre, proceso=proceso, proceso_etiqueta=proceso,
    ) for i, proceso in enumerate(procesos)]
    datos = generador.get(f'{BASE}/bajo-demanda/?trabajador_cedula=12345678').json()['data']
    assert {g['id'] for g in datos['generados']} == {str(d.id) for d in docs}
    assert {g['proceso'] for g in datos['generados']} == set(procesos)


def test_el_trabajador_debe_existir_y_la_cedula_es_obligatoria(generador, trabajador):
    assert generador.get(f'{BASE}/bajo-demanda/?trabajador_cedula=999').status_code == 404
    assert generador.get(f'{BASE}/bajo-demanda/').status_code == 400


def test_generar_guarda_snapshot_sha256_y_aparece_en_la_lista(generador, trabajador, constancia, almacen, con_motor_sin_cintillo):
    r = generador.post(f'{BASE}/bajo-demanda/generar/', {
        'plantilla_id': constancia['id'], 'trabajador_cedula': '12345678',
        'valores_propios': {'dirigida_a': 'Banco Central'}}, format='json')
    assert r.status_code == 201, r.content
    d = r.json()['data']
    assert d['proceso'] == 'bajo_demanda' and d['plantilla_codigo'] == 'CONSTANCIA' and d['version_numero'] == 1
    m = DocumentoGeneradoModel.objects.get(pk=d['id'])
    pdf = almacen.descargar(m.pdf_clave)
    assert m.pdf_sha256 == d['pdf_sha256'] == hashlib.sha256(pdf).hexdigest()
    assert (m.sujeto_tipo, m.sujeto_id, m.trabajador_cedula) == ('trabajador', '12345678', '12345678')
    assert m.datos_snapshot['cedula'] == 'V-12345678' and m.datos_snapshot['propio.dirigida_a'] == 'Banco Central'
    assert m.datos_snapshot['nombre_completo'] == 'PÉREZ ANA MARÍA'
    texto = ' '.join(texto_de(pdf).split())
    assert 'PÉREZ ANA MARÍA, V-12345678, solicita la constancia ante Banco Central.' in texto
    listado = generador.get(f'{BASE}/bajo-demanda/?trabajador_cedula=12345678').json()['data']
    assert [g['id'] for g in listado['generados']] == [d['id']]


def test_generar_valida_los_campos_propios_obligatorios(generador, trabajador, constancia, almacen, con_motor_sin_cintillo):
    r = generador.post(f'{BASE}/bajo-demanda/generar/', {
        'plantilla_id': constancia['id'], 'trabajador_cedula': '12345678', 'valores_propios': {}}, format='json')
    assert r.status_code == 400 and 'Dirigida a' in str(r.json())
    assert not DocumentoGeneradoModel.objects.exists() and almacen.objetos == {}


def test_no_se_genera_con_una_plantilla_de_otro_proceso_ni_inexistente(admin, generador, trabajador, constancia):
    otra = _crear(admin, codigo='DE_PC', proceso=PC)
    for plantilla_id in (otra['id'], '00000000-0000-4000-8000-000000000000'):
        r = generador.post(f'{BASE}/bajo-demanda/generar/', {'plantilla_id': plantilla_id, 'trabajador_cedula': '12345678'},
                           format='json')
        assert r.status_code == 404


def test_descargar_registra_la_bitacora_y_exige_permiso(generador, lector, sin_permisos, trabajador, constancia, almacen,
                                                       con_motor_sin_cintillo):
    d = generador.post(f'{BASE}/bajo-demanda/generar/', {
        'plantilla_id': constancia['id'], 'trabajador_cedula': '12345678', 'valores_propios': {'dirigida_a': 'X'}},
        format='json').json()['data']
    url = f"{BASE}/generados/{d['id']}/archivo/"
    r = generador.get(url)
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf' and b''.join(r.streaming_content).startswith(b'%PDF')
    assert AuditoriaLog.objects.filter(accion='DESCARGA_ARCHIVO', recurso_id=d['id']).exists()
    assert lector.get(url).status_code == 200  # ver plantillas también ve los documentos generados
    assert sin_permisos.get(url).status_code == 403


def test_los_documentos_de_movimiento_tambien_se_descargan_con_movimientos_ver(admin, trabajador, almacen,
                                                                               con_motor_sin_cintillo):
    from apps.documentos.application.use_cases.generar_documento import generar_documento
    from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
    from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM

    p = _crear(admin, codigo='MOV_TRASLADO', proceso='movimiento:traslado')
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('{origen} → {destino}')}, format='json')
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')

    class Proveedor:
        def datos_de(self, *a, **k):
            return {'origen': 'A', 'destino': 'B'}

    doc = generar_documento(RepoPlantillasORM(), RepoDocumentosORM(), Proveedor(), MotorPdfDocumentos(), almacen,
                            plantilla_id=p['id'], sujeto_tipo='trabajador', sujeto_id='12345678', actor_id=None,
                            trabajador_cedula='12345678')
    url = f'{BASE}/generados/{doc.id}/archivo/'
    assert _cliente('movimientos.ver').get(url).status_code == 200
    assert _cliente('documentos.generar_bajo_demanda').get(url).status_code == 200
    assert _cliente().get(url).status_code == 403


def test_bajo_demanda_descarga_cualquier_documento_vinculado_y_no_otros(admin, trabajador, almacen,
                                                                       con_motor_sin_cintillo):
    from apps.documentos.application.use_cases.generar_documento import generar_documento
    from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
    from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM

    p = _crear(admin, codigo='CONTRATO_VINCULADO', proceso='ingreso_contratacion')
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'definicion': _definicion('{nombre_completo}')}, format='json')
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')
    doc = generar_documento(
        RepoPlantillasORM(), RepoDocumentosORM(), None, MotorPdfDocumentos(), almacen,
        plantilla_id=p['id'], sujeto_tipo='expediente_postulacion', sujeto_id='exp-1', actor_id=None,
        datos_base={'nombre_completo': 'PÉREZ ANA MARÍA'}, trabajador_cedula='12345678',
    )
    url = f'{BASE}/generados/{doc.id}/archivo/'
    assert _cliente('documentos.generar_bajo_demanda').get(url).status_code == 200
    assert _cliente('movimientos.ver').get(url).status_code == 403
    assert _cliente().get(url).status_code == 403
