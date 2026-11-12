"""OC 2026-11-11: grupo sanguíneo obligatorio y documentos en la actualización."""
import datetime

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.familiares.infrastructure.models.familiar_models import (
    EmployeefamilyModel,
    FamilyDocumentModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import GrupoSanguineoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db
BASE = '/api/v1/familiares/empleado/'
CEDULA = '99000330'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=('familiares.crear', 'familiares.editar', 'familiares.ver')):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(
        user=Usuario(permisos or ('familiares.crear', 'familiares.editar', 'familiares.ver'))
    )
    return api


@pytest.fixture
def datos():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='M')
    hijo = ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)')
    grupo = GrupoSanguineoModel.objects.create(GrupoSanguineo='O+')
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo, total_anos_apn=0,
    )
    return {'sexo': sexo, 'hijo': hijo, 'grupo': grupo}


def _cuerpo(datos, **extra):
    """Mismo cuerpo que arma `repo-familiares-api.ts` (con `null` explícitos)."""
    cuerpo = {
        'cedula_familiar': '12345678',
        'primer_nombre': 'FAMILIAR',
        'segundo_nombre': None,
        'primer_apellido': 'PEREZ',
        'segundo_apellido': None,
        'parentesco_id': datos['hijo'].pk,
        'orden_hijo': None,
        'fecha_nacimiento': '2008-01-01',
        'sexo_id': datos['sexo'].pk,
        'mismo_ente': False,
        'heredero': False,
        'observaciones': None,
        'perfil_salud': {
            'grupo_sanguineo_id': datos['grupo'].pk,
            'alergias': [],
            'patologias_cronicas': [],
            'discapacidades': [],
        },
    }
    cuerpo.update(extra)
    return cuerpo


def test_registro_sin_grupo_sanguineo_es_400_con_el_campo(datos):
    cuerpo = _cuerpo(datos)
    cuerpo.pop('perfil_salud')

    respuesta = _cliente().post(BASE + f'{CEDULA}/', cuerpo, format='json')

    assert respuesta.status_code == 400
    errores = respuesta.json()['data']['errores']
    assert 'Seleccione el grupo sanguíneo' in errores['perfil_salud.grupo_sanguineo_id']


def test_registro_con_grupo_sanguineo_y_segundos_nombres_nulos(datos):
    """Causa del «Hay 2 datos por corregir»: `segundo_nombre`/`segundo_apellido` nulos."""
    respuesta = _cliente().post(BASE + f'{CEDULA}/', _cuerpo(datos), format='json')

    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json()['data']['segundo_nombre'] is None
    assert respuesta.json()['data']['segundo_apellido'] is None


def test_registro_hijo_menor_sin_cedula_sigue_generando_la_sintetica(datos):
    cuerpo = _cuerpo(datos, cedula_familiar=None, fecha_nacimiento='2022-01-01', orden_hijo=1)

    respuesta = _cliente().post(BASE + f'{CEDULA}/', cuerpo, format='json')

    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json()['data']['cedula_familiar'] == f'{CEDULA}-1'


def test_actualizacion_exige_el_grupo_sanguineo(datos):
    creado = _cliente().post(BASE + f'{CEDULA}/', _cuerpo(datos), format='json')
    familiar_id = creado.json()['data']['id']

    respuesta = _cliente().put(
        f'/api/v1/familiares/{familiar_id}/',
        {'primer_nombre': 'CAMBIO'},
        format='json',
    )

    assert respuesta.status_code == 400
    errores = respuesta.json()['data']['errores']
    assert 'Seleccione el grupo sanguíneo' in errores['perfil_salud.grupo_sanguineo_id']


def test_actualizacion_con_grupo_sanguineo_guarda_el_perfil(datos):
    creado = _cliente().post(BASE + f'{CEDULA}/', _cuerpo(datos), format='json')
    familiar_id = creado.json()['data']['id']

    respuesta = _cliente().put(
        f'/api/v1/familiares/{familiar_id}/',
        {
            'primer_nombre': 'CAMBIO',
            'segundo_nombre': None,
            'perfil_salud': {
                'grupo_sanguineo_id': datos['grupo'].pk,
                'alergias': [],
                'patologias_cronicas': [],
                'discapacidades': [],
            },
        },
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json()['data']['primer_nombre'] == 'CAMBIO'
    assert respuesta.json()['data']['perfil_salud']['grupo_sanguineo_id'] == datos['grupo'].pk


@pytest.fixture
def familiar_con_documento(datos):
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar='12345678',
        primer_nombre='FAMILIAR',
        primer_apellido='PEREZ',
        parentesco_id=datos['hijo'].pk,
        fechanacimiento=datetime.date(2001, 1, 1),
        sexo_id=datos['sexo'].pk,
    )
    documento = FamilyDocumentModel.objects.create(
        familymember_id=familiar.pk, document_type='cedula',
        file='familiares/1/version-anterior.pdf',
    )
    return familiar, documento


def _pdf(nombre: str = 'nueva-version.pdf') -> SimpleUploadedFile:
    return SimpleUploadedFile(nombre, b'%PDF-1.4\n%contenido de prueba\n', content_type='application/pdf')


def test_reemplazar_documento_cambia_el_archivo_y_conserva_el_registro(
    datos, familiar_con_documento, monkeypatch,
):
    familiar, documento = familiar_con_documento
    subidas = []
    eliminadas = []

    from apps.familiares.presentation.views import familiares_views as vistas

    monkeypatch.setattr(
        vistas.SeaweedFSStorage, 'subir',
        lambda self, clave, contenido, mime: subidas.append((clave, contenido, mime)),
    )
    monkeypatch.setattr(
        vistas.SeaweedFSStorage, 'eliminar',
        lambda self, clave: eliminadas.append(clave),
    )

    respuesta = _cliente().patch(
        f'/api/v1/familiares/{familiar.pk}/documentos/{documento.pk}/',
        {'file': _pdf()},
        format='multipart',
    )

    assert respuesta.status_code == 200, respuesta.content
    documento.refresh_from_db()
    assert documento.file.name.startswith(f'familiares/{familiar.pk}/')
    assert documento.file.name.endswith('.pdf')
    assert documento.file.name != 'familiares/1/version-anterior.pdf'
    assert respuesta.json()['data']['id'] == documento.pk
    assert respuesta.json()['data']['tipo_documento'] == 'cedula'
    assert len(subidas) == 1
    assert eliminadas == ['familiares/1/version-anterior.pdf']


def test_reemplazar_documento_exige_permiso_de_edicion(familiar_con_documento):
    familiar, documento = familiar_con_documento

    respuesta = _cliente('familiares.ver').patch(
        f'/api/v1/familiares/{familiar.pk}/documentos/{documento.pk}/',
        {'file': _pdf()},
        format='multipart',
    )

    assert respuesta.status_code == 403


def test_reemplazar_documento_de_otro_familiar_es_404(familiar_con_documento):
    _, documento = familiar_con_documento
    otro = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar='87654321',
        primer_nombre='OTRO',
        primer_apellido='PEREZ',
        parentesco_id=documento.familymember.parentesco_id,
        fechanacimiento=datetime.date(2000, 1, 1),
        sexo_id=documento.familymember.sexo_id,
    )

    respuesta = _cliente().patch(
        f'/api/v1/familiares/{otro.pk}/documentos/{documento.pk}/',
        {'file': _pdf()},
        format='multipart',
    )

    assert respuesta.status_code == 404


def test_subir_la_cedula_dos_veces_deja_un_solo_documento(datos, monkeypatch):
    """Un familiar solo puede tener una cédula: la segunda subida reemplaza la primera."""
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id=CEDULA,
        cedulaFamiliar='12345679',
        primer_nombre='FAMILIAR',
        primer_apellido='PEREZ',
        parentesco_id=datos['hijo'].pk,
        fechanacimiento=datetime.date(2001, 1, 1),
        sexo_id=datos['sexo'].pk,
    )
    subidas: list[str] = []
    eliminadas: list[str] = []

    from apps.familiares.presentation.views import familiares_views as vistas

    monkeypatch.setattr(
        vistas.SeaweedFSStorage, 'subir',
        lambda self, clave, contenido, mime: subidas.append(clave),
    )
    monkeypatch.setattr(
        vistas.SeaweedFSStorage, 'eliminar',
        lambda self, clave: eliminadas.append(clave),
    )

    api = _cliente()
    url = f'/api/v1/familiares/{familiar.pk}/documentos/'
    primera = api.post(url, {'tipo_documento': 'cedula', 'file': _pdf('cedula-1.pdf')}, format='multipart')
    segunda = api.post(url, {'tipo_documento': 'cedula', 'file': _pdf('cedula-2.pdf')}, format='multipart')

    assert primera.status_code == 200, primera.content
    assert segunda.status_code == 200, segunda.content
    assert segunda.json()['data']['id'] == primera.json()['data']['id']
    assert FamilyDocumentModel.objects.filter(
        familymember_id=familiar.pk, document_type='cedula',
    ).count() == 1
    assert len(subidas) == 2
    assert eliminadas == [subidas[0]]

    # La partida de nacimiento es otro tipo y no reemplaza a la cédula.
    partida = api.post(
        url, {'tipo_documento': 'partida_nacimiento', 'file': _pdf('partida.pdf')},
        format='multipart',
    )
    assert partida.status_code == 200, partida.content
    assert FamilyDocumentModel.objects.filter(familymember_id=familiar.pk).count() == 2
    assert partida.json()['data']['id'] != primera.json()['data']['id']

    # La operación queda auditada como reemplazo de la cédula.
    from core.infrastructure.models.auditoria import AuditoriaLog

    assert AuditoriaLog.objects.filter(
        accion='familiares.documento_reemplazado',
        recurso_tipo='documento_familiar',
        recurso_id=str(primera.json()['data']['id']),
    ).exists()
