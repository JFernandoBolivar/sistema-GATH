"""Siembra de las plantillas del ingreso de personal (F-4, F-5): borrador, idempotencia, `--actualizar` y vistas previas."""
import pytest
from django.core.management import CommandError, call_command

from apps.documentos.infrastructure.models.documentos_models import PlantillaDocumentoModel
from tests.unit.documentos._ayudas import paginas_de, pdf_fondo, texto_de

pytestmark = pytest.mark.django_db

BASE = '/api/v1/documentos'
CODIGOS = {
    'NOTIFICACION_ITINERANCIA', 'AFILIACION_CAJA_AHORRO', 'OFERTA_SERVICIOS', 'HCM_SEGUROS_MIRANDA',
    'CONTRATO_TRABAJO', 'DECLARACION_JURADA_INCOMPATIBILIDAD', 'AUTORIZACION_DATOS_PERSONALES',
}


@pytest.fixture
def pdfs(tmp_path):
    caja, hcm = tmp_path / 'caja.pdf', tmp_path / 'hcm.pdf'
    caja.write_bytes(pdf_fondo(1))
    hcm.write_bytes(pdf_fondo(6, 612, 792))  # carta vertical, como la planilla de la aseguradora una vez girada
    return ['--pdf-caja-ahorro', str(caja), '--pdf-hcm', str(hcm)]


def _plantilla(codigo):
    return PlantillaDocumentoModel.objects.get(codigo=codigo)


def test_crea_las_siete_en_borrador_con_sus_metadatos(almacen, pdfs):
    call_command('sembrar_plantillas_documentos', *pdfs)
    assert set(PlantillaDocumentoModel.objects.values_list('codigo', flat=True)) == CODIGOS
    assert not PlantillaDocumentoModel.objects.filter(ultima_version__gt=0).exists()  # todas en borrador
    assert len(almacen.objetos) == 2  # los dos PDF oficiales, solo al almacén falso
    esperado = {
        'OFERTA_SERVICIOS': ('formulario', 'ventana2', 'postulante'),
        'HCM_SEGUROS_MIRANDA': ('pdf_overlay', 'ventana2', 'postulante'),
        'CONTRATO_TRABAJO': ('formulario', 'contratacion', 'ambos'),
        'DECLARACION_JURADA_INCOMPATIBILIDAD': ('formulario', 'ventana2', 'postulante'),
        'AUTORIZACION_DATOS_PERSONALES': ('formulario', 'ventana2', 'postulante'),
    }
    for codigo, (modo, momento, firmante) in esperado.items():
        p = _plantilla(codigo)
        assert (p.modo, p.momento, p.firmante, p.requiere_firma_clic) == (modo, momento, firmante, True), codigo
    hcm = _plantilla('HCM_SEGUROS_MIRANDA')
    assert hcm.fondo_clave and [p['origen'] for p in hcm.definicion['paginas']] == [1, 2, 3, 4, 5, 6]


def test_es_idempotente_y_actualizar_restaura_el_diseno(almacen, pdfs):
    call_command('sembrar_plantillas_documentos', *pdfs)
    PlantillaDocumentoModel.objects.filter(codigo='OFERTA_SERVICIOS').update(nombre='Editada por el área')
    PlantillaDocumentoModel.objects.filter(codigo='CONTRATO_TRABAJO').update(nombre='Editada por el área')
    call_command('sembrar_plantillas_documentos', *pdfs)  # no pisa
    assert PlantillaDocumentoModel.objects.count() == 7 and len(almacen.objetos) == 2
    assert _plantilla('OFERTA_SERVICIOS').nombre == 'Editada por el área'

    call_command('sembrar_plantillas_documentos', '--actualizar', '--solo', 'OFERTA_SERVICIOS')
    assert _plantilla('OFERTA_SERVICIOS').nombre == 'Oferta de Servicios'
    assert _plantilla('CONTRATO_TRABAJO').nombre == 'Editada por el área'  # --solo limita la acción

    # Un formato de terceros se actualiza sin volver a subir su PDF.
    call_command('sembrar_plantillas_documentos', '--actualizar', '--solo', 'HCM_SEGUROS_MIRANDA')
    assert len(almacen.objetos) == 2 and _plantilla('HCM_SEGUROS_MIRANDA').fondo_clave


def test_codigo_desconocido_se_rechaza(almacen):
    with pytest.raises(CommandError):
        call_command('sembrar_plantillas_documentos', '--solo', 'NO_EXISTE')


def test_todas_tienen_vista_previa_valida(admin, almacen, pdfs):
    call_command('sembrar_plantillas_documentos', *pdfs)
    for codigo in sorted(CODIGOS):
        r = admin.post(f'{BASE}/plantillas/{_plantilla(codigo).id}/vista-previa/', {}, format='json')
        assert r.status_code == 200, (codigo, r.data)
        assert r.content.startswith(b'%PDF-') and paginas_de(r.content) >= 1, codigo
    hcm = admin.post(f"{BASE}/plantillas/{_plantilla('HCM_SEGUROS_MIRANDA').id}/vista-previa/", {}, format='json')
    assert paginas_de(hcm.content) == 6
    assert 'COMISIÓN NACIONAL DE TELECOMUNICACIONES' in texto_de(hcm.content)


def test_los_modelos_juridicos_estan_marcados_y_la_oferta_usa_las_colecciones(admin, almacen, pdfs):
    call_command('sembrar_plantillas_documentos', *pdfs)
    for codigo in ('CONTRATO_TRABAJO', 'DECLARACION_JURADA_INCOMPATIBILIDAD', 'AUTORIZACION_DATOS_PERSONALES'):
        r = admin.post(f'{BASE}/plantillas/{_plantilla(codigo).id}/vista-previa/', {}, format='json')
        assert 'MODELO: revisar el texto legal con Consultoría Jurídica antes de publicar' in ' '.join(texto_de(r.content).split()), codigo
    oferta = _plantilla('OFERTA_SERVICIOS')
    colecciones = {b['coleccion'] for b in oferta.definicion['bloques'] if b['tipo'] == 'tabla'}
    assert colecciones == {'estudios', 'cursos', 'idiomas', 'familiares', 'antecedentes'}
    assert len(oferta.campos_propios) <= 40
    texto = ' '.join(texto_de(admin.post(f'{BASE}/plantillas/{oferta.id}/vista-previa/', {}, format='json').content).split())
    assert 'OFERTA DE SERVICIOS' in texto and 'GESTIÓN DEL ESPECTRO RADIOELÉCTRICO' in texto and 'INGLÉS' in texto


def test_se_pueden_publicar_todas(admin, almacen, pdfs):
    call_command('sembrar_plantillas_documentos', *pdfs)
    for codigo in sorted(CODIGOS):
        assert admin.post(f'{BASE}/plantillas/{_plantilla(codigo).id}/publicar/').status_code == 201, codigo
