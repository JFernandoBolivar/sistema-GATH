"""Generar un DocumentoGenerado con snapshot y sha256 (proveedor falso), descarga con bitácora y firma con evidencia."""
import hashlib

import pytest

from apps.documentos.application.use_cases.firmar_documento import firmar_documento
from apps.documentos.application.use_cases.generar_documento import generar_documento
from apps.documentos.infrastructure.models.documentos_models import FirmaDocumentoModel
from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.documentos.test_plantillas_api import BASE, _formulario_completo
from tests.unit.documentos._ayudas import texto_de

pytestmark = pytest.mark.django_db


class _Motor(MotorPdfDocumentos):
    def renderizar(self, contexto, datos):
        return super().renderizar({**contexto, 'config_pdf': None}, datos)


@pytest.fixture
def plantilla_activa(admin):
    p = _formulario_completo(admin)
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')
    return p


def _generar(plantilla, almacen, proveedor, **kw):
    return generar_documento(
        RepoPlantillasORM(), RepoDocumentosORM(), proveedor, _Motor(), almacen,
        plantilla_id=plantilla['id'], sujeto_tipo='postulante', sujeto_id='12345678', actor_id=7,
        valores_propios=kw.pop('valores_propios', {'sueldo': '1500 USD'}), **kw)


def test_generar_guarda_snapshot_huella_y_version(plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    assert proveedor.llamadas == [('postulante', '12345678')]
    assert doc.version_numero == 1 and doc.sujeto_id == '12345678' and doc.generado_por_id == 7
    pdf = almacen.descargar(doc.pdf_clave)
    assert doc.pdf_sha256 == hashlib.sha256(pdf).hexdigest()
    assert doc.pdf_clave.startswith('documentos/generados/')
    assert doc.datos_snapshot['cedula'] == 'V-12345678' and doc.datos_snapshot['propio.sueldo'] == '1500 USD'
    assert doc.datos_snapshot['fecha_hoy']
    texto = texto_de(pdf)
    assert 'V-12345678' in texto and '1500 USD' in texto


def test_el_documento_conserva_la_version_aunque_la_plantilla_cambie(admin, plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    d = plantilla_activa['definicion']
    d['encabezado']['titulo'] = 'Otro título'
    admin.put(f"{BASE}/plantillas/{plantilla_activa['id']}/", {'definicion': d}, format='json')
    admin.post(f"{BASE}/plantillas/{plantilla_activa['id']}/publicar/")
    doc2 = _generar(plantilla_activa, almacen, proveedor)
    assert (doc.version_numero, doc2.version_numero) == (1, 2)
    assert RepoDocumentosORM().obtener_generado(doc.id).version_numero == 1


def test_generar_exige_plantilla_activa_y_campos_propios_obligatorios(admin, plantilla_activa, almacen, proveedor):
    with pytest.raises(ValidationError, match='obligatorio'):
        _generar(plantilla_activa, almacen, proveedor, valores_propios={})
    admin.post(f"{BASE}/plantillas/{plantilla_activa['id']}/activar/", {'activa': False}, format='json')
    with pytest.raises(ConflictError):
        _generar(plantilla_activa, almacen, proveedor)
    with pytest.raises(NotFoundError):
        _generar({'id': '00000000-0000-0000-0000-000000000000'}, almacen, proveedor)


def test_descarga_autenticada_registra_en_la_bitacora(admin, lector, sin_permisos, plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    assert sin_permisos.get(f'{BASE}/generados/{doc.id}/archivo/').status_code == 403
    r = lector.get(f'{BASE}/generados/{doc.id}/archivo/')
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf'
    assert b''.join(r.streaming_content) == almacen.descargar(doc.pdf_clave)
    log = AuditoriaLog.objects.get(accion='DESCARGA_ARCHIVO', recurso_tipo='documento_generado')
    assert log.recurso_id == doc.id and log.resultado == AuditoriaLog.Resultado.SUCCESS


def test_descarga_de_un_documento_inexistente(lector):
    assert lector.get(f'{BASE}/generados/00000000-0000-0000-0000-000000000000/archivo/').status_code == 404


def test_detalle_del_documento_con_firmas(lector, plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    d = lector.get(f'{BASE}/generados/{doc.id}/').data['data']
    assert d['pdf_sha256'] == doc.pdf_sha256 and d['firmas'] == [] and d['version_numero'] == 1


def _firmar(doc, almacen, **kw):
    datos = dict(documento_id=doc.id, firmante_tipo='postulante', firmante_id='12345678', ip='10.0.0.5',
                 user_agent='Mozilla/5.0 prueba', acepta=True)
    datos.update(kw)
    return firmar_documento(RepoPlantillasORM(), RepoDocumentosORM(), almacen, **datos)


def test_firma_guarda_la_evidencia(plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    firma = _firmar(doc, almacen)
    assert firma.sha256_firmado == doc.pdf_sha256
    assert firma.ip == '10.0.0.5' and firma.user_agent.startswith('Mozilla') and firma.firmado_en
    assert 'Documento de prueba' in firma.texto_conformidad and 'versión 1' in firma.texto_conformidad
    assert FirmaDocumentoModel.objects.count() == 1


def test_firma_rechazos(plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    with pytest.raises(ValidationError, match='aceptar'):
        _firmar(doc, almacen, acepta=False)
    with pytest.raises(ConflictError, match='no corresponde'):
        _firmar(doc, almacen, firmante_tipo='conatel')  # la plantilla la firma el postulante
    _firmar(doc, almacen)
    with pytest.raises(ConflictError, match='ya firm'):
        _firmar(doc, almacen)
    with pytest.raises(NotFoundError):
        _firmar(type('D', (), {'id': '00000000-0000-0000-0000-000000000000'})(), almacen)


def test_no_se_firma_un_archivo_alterado(plantilla_activa, almacen, proveedor):
    doc = _generar(plantilla_activa, almacen, proveedor)
    almacen.objetos[doc.pdf_clave] = almacen.objetos[doc.pdf_clave] + b'alterado'
    with pytest.raises(ConflictError, match='huella'):
        _firmar(doc, almacen)


def test_plantilla_sin_firma_por_clic(admin, almacen, proveedor):
    p = _formulario_completo(admin, codigo='SIN_FIRMA')
    admin.put(f"{BASE}/plantillas/{p['id']}/", {'requiere_firma_clic': False}, format='json')
    admin.post(f"{BASE}/plantillas/{p['id']}/publicar/")
    admin.post(f"{BASE}/plantillas/{p['id']}/activar/", {'activa': True}, format='json')
    doc = _generar(p, almacen, proveedor)
    with pytest.raises(ConflictError, match='no requiere'):
        _firmar(doc, almacen)
