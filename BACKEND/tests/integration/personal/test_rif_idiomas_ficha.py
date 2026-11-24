"""RIF e idiomas en la ficha (F-8): el detalle los expone y RR. HH. los edita con permiso y auditoría."""
import pytest
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.idioma_models import EmpleadoIdiomaModel, IdiomaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

CEDULA = '99006677'
URL = f'/api/v1/personal/{CEDULA}/'
URL_RIF = f'{URL}rif/'
URL_IDIOMAS = f'{URL}idiomas/'
URL_CATALOGO = '/api/v1/personal/catalogos/idiomas/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.cedula_id = 'V-1'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def trabajador():
    nac = NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})[0]
    sexo = SexoModel.objects.create(sexo='F')
    return EmployeeModel.objects.create(cedulaidentidad=CEDULA, nombres='ANA', apellidos='PEREZ', sexoid=sexo, nacionalidad=nac)


@pytest.fixture
def idiomas():
    return IdiomaModel.objects.create(nombre='Inglés'), IdiomaModel.objects.create(nombre='Francés')


# ------------------------------------------------------------------------------------------------ detalle
def test_el_detalle_sin_datos_devuelve_rif_nulo_e_idiomas_vacios(trabajador):
    d = _cliente('personal.ver_detalle').get(URL).json()['data']
    assert d['rif'] is None and d['idiomas'] == []


def test_el_detalle_expone_el_rif_y_los_idiomas(trabajador, idiomas):
    ingles, _ = idiomas
    EmployeeModel.objects.filter(pk=trabajador.pk).update(rif='V-12345678-9')
    EmpleadoIdiomaModel.objects.create(empleado=trabajador, idioma=ingles, nivel='BIEN')
    EmpleadoIdiomaModel.objects.create(empleado=trabajador, otro_idioma='Guaraní', nivel='POCO')
    d = _cliente('personal.ver_detalle').get(URL).json()['data']
    assert d['rif'] == 'V-12345678-9'
    assert [(i['nombre'], i['nivel'], i['idioma_id']) for i in d['idiomas']] == [('Inglés', 'BIEN', ingles.pk), ('Guaraní', 'POCO', None)]


# ------------------------------------------------------------------------------------------------ RIF
def test_patch_rif_normaliza_guarda_y_audita(trabajador):
    r = _cliente('personal.editar_personales').patch(URL_RIF, {'rif': 'v-12345678-9'}, format='json')
    assert r.status_code == 200, r.content
    assert r.json()['data']['rif'] == 'V-12345678-9'
    assert EmployeeModel.objects.get(pk=trabajador.pk).rif == 'V-12345678-9'
    r = _cliente('personal.editar_personales').patch(URL_RIF, {'rif': 'J-301234567'}, format='json')
    assert r.status_code == 200
    log = AuditoriaLog.objects.filter(accion='personal.rif_actualizado', recurso_id=CEDULA).order_by('-pk').first()
    assert log.estado_previo == {'rif': 'V-12345678-9'} and log.estado_nuevo == {'rif': 'J-30123456-7'}


def test_patch_rif_vacio_lo_borra(trabajador):
    EmployeeModel.objects.filter(pk=trabajador.pk).update(rif='V-12345678-9')
    r = _cliente('personal.editar_personales').patch(URL_RIF, {'rif': ''}, format='json')
    assert r.status_code == 200 and r.json()['data']['rif'] is None
    assert EmployeeModel.objects.get(pk=trabajador.pk).rif is None


@pytest.mark.parametrize('valor', ['12345678', 'X-12345678-9', 'V-12'])
def test_patch_rif_invalido_da_400_y_no_cambia_nada(trabajador, valor):
    r = _cliente('personal.editar_personales').patch(URL_RIF, {'rif': valor}, format='json')
    assert r.status_code == 400, r.content
    assert EmployeeModel.objects.get(pk=trabajador.pk).rif is None
    assert not AuditoriaLog.objects.filter(accion='personal.rif_actualizado').exists()


def test_patch_rif_sin_permiso_da_403(trabajador):
    for permiso in ('personal.ver_detalle', 'personal.editar_educacion'):
        r = _cliente(permiso).patch(URL_RIF, {'rif': 'V-12345678-9'}, format='json')
        assert r.status_code == 403
    assert EmployeeModel.objects.get(pk=trabajador.pk).rif is None


def test_patch_rif_de_trabajador_inexistente_da_404(trabajador):
    r = _cliente('personal.editar_personales').patch('/api/v1/personal/00000000/rif/', {'rif': 'V-12345678-9'}, format='json')
    assert r.status_code == 404


# ------------------------------------------------------------------------------------------------ idiomas
def test_put_idiomas_reemplaza_la_lista_y_audita(trabajador, idiomas):
    ingles, frances = idiomas
    editor = _cliente('personal.editar_educacion')
    r = editor.put(URL_IDIOMAS, {'idiomas': [
        {'idioma_id': ingles.pk, 'nivel': 'bien'}, {'otro_idioma': 'Guaraní', 'nivel': 'POCO'}]}, format='json')
    assert r.status_code == 200, r.content
    assert [(i['nombre'], i['nivel']) for i in r.json()['data']] == [('Inglés', 'BIEN'), ('Guaraní', 'POCO')]
    r = editor.put(URL_IDIOMAS, {'idiomas': [{'idioma_id': frances.pk, 'nivel': 'REGULAR'}]}, format='json')
    assert r.status_code == 200
    assert [(i.idioma_id, i.nivel) for i in EmpleadoIdiomaModel.objects.filter(empleado=trabajador)] == [(frances.pk, 'REGULAR')]
    log = AuditoriaLog.objects.filter(accion='personal.idiomas_actualizados', recurso_id=CEDULA).order_by('-pk').first()
    assert log.estado_previo == {'idiomas': [{'nombre': 'Inglés', 'nivel': 'BIEN'}, {'nombre': 'Guaraní', 'nivel': 'POCO'}]}
    assert log.estado_nuevo == {'idiomas': [{'nombre': 'Francés', 'nivel': 'REGULAR'}]}


def test_put_idiomas_vacio_los_quita(trabajador, idiomas):
    EmpleadoIdiomaModel.objects.create(empleado=trabajador, idioma=idiomas[0], nivel='BIEN')
    r = _cliente('personal.editar_educacion').put(URL_IDIOMAS, {'idiomas': []}, format='json')
    assert r.status_code == 200 and r.json()['data'] == []
    assert not EmpleadoIdiomaModel.objects.filter(empleado=trabajador).exists()


@pytest.mark.parametrize('cuerpo', [
    {}, {'idiomas': 'x'}, {'idiomas': [{'nivel': 'BIEN'}]}, {'idiomas': [{'idioma_id': 1, 'nivel': 'ALTO'}]},
    {'idiomas': [{'idioma_id': 1, 'otro_idioma': 'X', 'nivel': 'BIEN'}]},
])
def test_put_idiomas_invalidos_dan_400(trabajador, idiomas, cuerpo):
    r = _cliente('personal.editar_educacion').put(URL_IDIOMAS, cuerpo, format='json')
    assert r.status_code == 400, r.content


def test_put_idiomas_con_un_id_que_no_existe_da_400_y_conserva_lo_anterior(trabajador, idiomas):
    EmpleadoIdiomaModel.objects.create(empleado=trabajador, idioma=idiomas[0], nivel='BIEN')
    r = _cliente('personal.editar_educacion').put(URL_IDIOMAS, {'idiomas': [{'idioma_id': 9999, 'nivel': 'BIEN'}]}, format='json')
    assert r.status_code == 400, r.content
    assert EmpleadoIdiomaModel.objects.filter(empleado=trabajador).count() == 1


def test_put_idiomas_repetidos_da_400(trabajador, idiomas):
    r = _cliente('personal.editar_educacion').put(URL_IDIOMAS, {'idiomas': [
        {'idioma_id': idiomas[0].pk, 'nivel': 'BIEN'}, {'idioma_id': idiomas[0].pk, 'nivel': 'POCO'}]}, format='json')
    assert r.status_code == 400


def test_put_idiomas_sin_permiso_da_403(trabajador, idiomas):
    for permiso in ('personal.ver_detalle', 'personal.editar_personales'):
        r = _cliente(permiso).put(URL_IDIOMAS, {'idiomas': [{'idioma_id': idiomas[0].pk, 'nivel': 'BIEN'}]}, format='json')
        assert r.status_code == 403
    assert not EmpleadoIdiomaModel.objects.exists()


def test_put_idiomas_de_trabajador_inexistente_da_404(trabajador):
    assert _cliente('personal.editar_educacion').put('/api/v1/personal/00000000/idiomas/', {'idiomas': []}, format='json').status_code == 404


def test_get_idiomas_exige_ver_detalle(trabajador, idiomas):
    EmpleadoIdiomaModel.objects.create(empleado=trabajador, idioma=idiomas[0], nivel='BIEN')
    assert _cliente('personal.editar_educacion').get(URL_IDIOMAS).status_code == 403
    r = _cliente('personal.ver_detalle').get(URL_IDIOMAS)
    assert r.status_code == 200 and r.json()['data'][0]['nombre'] == 'Inglés'


def test_catalogo_de_idiomas(idiomas):
    IdiomaModel.objects.create(nombre='Latín', activo=False)
    assert _cliente().get(URL_CATALOGO).status_code == 403
    r = _cliente('personal.ver').get(URL_CATALOGO)
    assert r.status_code == 200 and [i['nombre'] for i in r.json()['data']] == ['Francés', 'Inglés']


def test_un_idioma_del_catalogo_no_se_repite_por_trabajador(trabajador, idiomas):
    from django.db import IntegrityError, transaction
    EmpleadoIdiomaModel.objects.create(empleado=trabajador, idioma=idiomas[0], nivel='BIEN')
    with pytest.raises(IntegrityError), transaction.atomic():
        EmpleadoIdiomaModel.objects.create(empleado=trabajador, idioma=idiomas[0], nivel='POCO')
