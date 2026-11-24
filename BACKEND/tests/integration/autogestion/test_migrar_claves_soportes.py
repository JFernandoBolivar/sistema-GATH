"""H-2: comando `migrar_claves_soportes` (en seco por defecto, idempotente, sin tocar la fila si la copia falla)."""
import uuid
from io import StringIO

import pytest
from django.core.management import call_command

from apps.autogestion.infrastructure.models.actualizacion_models import SoporteDocumentalModel
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CEDULA = '20111234'
SID = str(uuid.uuid4())


class Almacen:
    def __init__(self):
        self.objetos = {}
        self.falla_subir = False
        self.falla_eliminar = False

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        if self.falla_subir:
            raise RuntimeError('almacén caído')
        self.objetos[clave] = contenido
        return clave

    def descargar(self, clave):
        return self.objetos[clave]

    def eliminar(self, clave):
        if self.falla_eliminar:
            raise RuntimeError('no se pudo borrar')
        self.objetos.pop(clave, None)


@pytest.fixture
def almacen(monkeypatch):
    a = Almacen()
    monkeypatch.setattr('apps.autogestion.management.commands.migrar_claves_soportes.SeaweedFSStorage', lambda: a)
    return a


def soporte(clave, origen=None):
    return SoporteDocumentalModel.objects.create(
        origen_tipo='ACTUALIZACION', origen_id=origen or SID, seccion='foto', tipo='FOTO', clave_s3=clave,
        mime_real='image/jpeg', tamano_bytes=3, sha256='0' * 64, subido_por=CEDULA,
    )


def correr(*args):
    salida = StringIO()
    call_command('migrar_claves_soportes', *args, stdout=salida)
    return salida.getvalue()


@pytest.fixture
def vieja(almacen):
    clave = f'autogestion/soportes/{CEDULA}/{SID}/abc.jpg'
    almacen.objetos[clave] = b'JPG'
    return clave


def test_en_seco_no_cambia_nada(almacen, vieja):
    fila = soporte(vieja)
    salida = correr()
    assert 'EN SECO' in salida and 'con cédula en la ruta: 1' in salida
    fila.refresh_from_db()
    assert fila.clave_s3 == vieja and list(almacen.objetos) == [vieja]


def test_aplicado_migra_filas_foto_del_empleado_y_borra_la_vieja(almacen, vieja):
    otra = soporte(vieja, origen=str(uuid.uuid4()))  # copia del soporte con la misma clave (repo_cambios_soportes)
    fila = soporte(vieja)
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='M', apellidos='P', sexoid=sexo, profile=vieja, foto_objeto=vieja,
    )
    correr('--aplicar')
    fila.refresh_from_db(); otra.refresh_from_db()
    nueva = fila.clave_s3
    assert nueva == otra.clave_s3 and CEDULA not in nueva and nueva.count('/') == 2 and nueva.endswith('.jpg')
    assert almacen.objetos == {nueva: b'JPG'}
    emp = EmployeeModel.objects.get(cedulaidentidad=CEDULA)
    assert emp.profile == nueva and emp.foto_objeto == nueva


def test_es_idempotente(almacen, vieja):
    fila = soporte(vieja)
    correr('--aplicar')
    fila.refresh_from_db()
    primera = fila.clave_s3
    assert 'con cédula en la ruta: 0' in correr('--aplicar')
    fila.refresh_from_db()
    assert fila.clave_s3 == primera and list(almacen.objetos) == [primera]


def test_si_la_copia_falla_no_toca_la_fila_ni_borra(almacen, vieja):
    fila = soporte(vieja)
    almacen.falla_subir = True
    assert 'fallidas: 1' in correr('--aplicar')
    fila.refresh_from_db()
    assert fila.clave_s3 == vieja and list(almacen.objetos) == [vieja]


def test_si_no_se_puede_borrar_la_vieja_la_fila_ya_apunta_a_la_nueva(almacen, vieja):
    fila = soporte(vieja)
    almacen.falla_eliminar = True
    assert f'huérfano: {vieja}' in correr('--aplicar')
    fila.refresh_from_db()
    assert fila.clave_s3 != vieja and fila.clave_s3 in almacen.objetos


def test_las_claves_nuevas_no_se_tocan(almacen):
    fila = soporte(f'autogestion/soportes/{uuid.uuid4().hex}.pdf')
    assert 'con cédula en la ruta: 0' in correr('--aplicar')
    assert fila.clave_s3 == SoporteDocumentalModel.objects.get(pk=fila.pk).clave_s3
