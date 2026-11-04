"""Histórico de imágenes del cintillo: subida, poda a 5, restauración, permisos, auditoría y migración."""
import importlib
from unittest.mock import MagicMock, patch

import pytest
from django.apps import apps as django_apps
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.configuracion.infrastructure.models.configuracion_visual_model import ConfiguracionVisualModel
from apps.configuracion.infrastructure.models.version_imagen_cintillo_model import VersionImagenCintilloModel
from apps.configuracion.infrastructure.repositories.repo_configuracion_visual_orm import RepoConfiguracionVisualORM
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/configuracion/visual/logo/logo-principal/'
CAMPO = 'logo_principal_clave'
PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 64


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=1, cedula='V12345678'):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol = type('Rol', (), {'nombre_rol': 'ADMINISTRADOR'})()
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def almacen():
    with patch('apps.configuracion.presentation.views.configuracion_visual_views.SeaweedFSStorage') as cls:
        instancia = MagicMock()
        cls.return_value = instancia
        yield instancia


def subir(api, nombre='logo.png'):
    return api.post(BASE, {'file': SimpleUploadedFile(nombre, PNG, content_type='image/png')}, format='multipart')


def test_subir_seis_veces_deja_cinco_versiones_y_borra_la_mas_vieja(almacen):
    api = cliente('configuracion.editar')
    for _ in range(6):
        assert subir(api).status_code == 200

    versiones = VersionImagenCintilloModel.objects.filter(campo=CAMPO)
    assert versiones.count() == 5
    assert versiones.filter(es_vigente=True).count() == 1
    assert almacen.eliminar.call_count == 1
    vigente = versiones.get(es_vigente=True)
    assert RepoConfiguracionVisualORM().obtener().logo_principal_clave == vigente.clave
    # La borrada ya no existe en el histórico.
    assert almacen.eliminar.call_args.args[0] not in set(versiones.values_list('clave', flat=True))


def test_subir_no_borra_la_anterior_si_hay_espacio(almacen):
    api = cliente('configuracion.editar')
    subir(api)
    subir(api)
    assert VersionImagenCintilloModel.objects.filter(campo=CAMPO).count() == 2
    almacen.eliminar.assert_not_called()


def test_listar_versiones_mas_reciente_primero_con_url_y_vigente(almacen):
    api = cliente('configuracion.editar')
    subir(api)
    subir(api)
    respuesta = cliente().get(BASE + 'versiones/')
    assert respuesta.status_code == 200
    filas = respuesta.json()['data']
    assert [f['es_vigente'] for f in filas] == [True, False]
    assert filas[0]['url'].startswith(BASE + 'versiones/')
    assert filas[0]['subido_por_cedula'] == 'V12345678'


def test_restaurar_cambia_la_vigente_y_la_configuracion(almacen):
    api = cliente('configuracion.editar')
    subir(api)
    subir(api)
    anterior = VersionImagenCintilloModel.objects.filter(campo=CAMPO, es_vigente=False).get()

    respuesta = api.post(f'{BASE}versiones/{anterior.pk}/restaurar/')

    assert respuesta.status_code == 200
    anterior.refresh_from_db()
    assert anterior.es_vigente is True
    assert VersionImagenCintilloModel.objects.filter(campo=CAMPO, es_vigente=True).count() == 1
    # Lo que leen los PDF (clave vigente de la configuración) es la restaurada.
    assert RepoConfiguracionVisualORM().obtener().logo_principal_clave == anterior.clave


def test_subida_y_restauracion_quedan_en_auditoria(almacen):
    api = cliente('configuracion.editar')
    subir(api)
    subir(api)
    anterior = VersionImagenCintilloModel.objects.filter(campo=CAMPO, es_vigente=False).get()
    api.post(f'{BASE}versiones/{anterior.pk}/restaurar/')

    assert AuditoriaLog.objects.filter(accion='configuracion.imagen_cintillo_subida').count() == 2
    restauracion = AuditoriaLog.objects.get(accion='configuracion.imagen_cintillo_restaurada')
    assert restauracion.recurso_id == CAMPO
    assert restauracion.estado_nuevo['version_id'] == str(anterior.pk)


def test_restaurar_exige_permiso_de_edicion(almacen):
    subir(cliente('configuracion.editar'))
    version = VersionImagenCintilloModel.objects.get(campo=CAMPO)
    assert cliente().post(f'{BASE}versiones/{version.pk}/restaurar/').status_code == 403


def test_restaurar_con_cintillo_generico_se_rechaza(almacen):
    subir(cliente('configuracion.editar'))
    version = VersionImagenCintilloModel.objects.get(campo=CAMPO)
    ConfiguracionVisualModel.objects.update(tipo_cintillo='GENERICO')
    respuesta = cliente('configuracion.editar').post(f'{BASE}versiones/{version.pk}/restaurar/')
    assert respuesta.status_code == 400


def test_restaurar_version_de_otra_imagen_devuelve_404(almacen):
    subir(cliente('configuracion.editar'))
    version = VersionImagenCintilloModel.objects.get(campo=CAMPO)
    respuesta = cliente('configuracion.editar').post(
        f'/api/v1/configuracion/visual/logo/logo-secundario/versiones/{version.pk}/restaurar/'
    )
    assert respuesta.status_code == 404


def test_migracion_de_datos_crea_la_version_inicial_vigente():
    ConfiguracionVisualModel.objects.all().delete()
    ConfiguracionVisualModel.objects.create(
        logo_principal_clave='configuracion/logo-principal/a.png', cintillo_pie_clave='configuracion/cintillo-pie/b.jpg',
    )
    migracion = importlib.import_module('apps.configuracion.migrations.0005_sembrar_versiones_imagen_cintillo')

    migracion.sembrar(django_apps, None)
    migracion.sembrar(django_apps, None)  # idempotente

    filas = VersionImagenCintilloModel.objects.all()
    assert filas.count() == 2
    assert all(f.es_vigente for f in filas)
    assert {f.campo: f.mime for f in filas} == {
        'logo_principal_clave': 'image/png', 'cintillo_pie_clave': 'image/jpeg',
    }
